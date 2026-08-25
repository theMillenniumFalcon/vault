# Multi-Agent Conflict Resolution

Reference for how Vault handles conflicting claims across agents. Documents **current behavior** in code and **design notes** for future work.

**Key code:** `src/memory.ts`, `src/classify.ts`, `src/resolve.ts`, `src/ops.ts`, `src/db/schema.ts`

**Tests:** `test/multi-agent-conflict.test.ts`, `test/classify-two-pass.test.ts`, `test/resolve.test.ts`

---

## Overview

When an agent stores a new fact, Vault runs a **two-pass classifier**:

1. **Pass 1 — own history** (`classifyAgainstOwnHistory`): compare against claims from the **same** `sourceAgent`. LLM returns `ADD`, `UPDATE`, `REPLACE`, or `NOOP`.
2. **Pass 2 — other agents** (`classifyAgainstOtherAgents`): runs **only when pass 1 returns `ADD`**. Looks for **active** claims on the **same `entity`** from **other** agents and applies a resolution **strategy**.

### Why two passes?

| Pass | Question | Mechanism |
|------|----------|-----------|
| 1 | Did *I* already know this / am I refining *my* memory? | Semantic similarity + LLM |
| 2 | Does this conflict with what *other agents* believe? | Entity-scoped search + policy (recency or authority) |

Pass 2 is skipped when pass 1 is `UPDATE`, `REPLACE`, or `NOOP` — the fact is already reconciled within the writing agent's history.

---

## Pass 1: Same-agent classification

- Vector search: top similar claims where `sourceAgent === writing agent` and `status === active`.
- LLM classifies:
  - **ADD** — new information
  - **UPDATE** — refines existing claim without contradicting
  - **REPLACE** — contradicts / supersedes own prior claim
  - **NOOP** — restates existing claim; nothing written

If **NOOP**, processing stops for that fact.

---

## Pass 2: Cross-agent resolution

Triggered only when pass 1 returns **ADD**.

1. Search for active claims on the same **`entity`**, excluding the writing agent.
2. If none → **ADD** (no conflict).
3. If conflicts exist → resolve via `strategyForEntity(entity)` (exact or wildcard `entityStrategies`) or default **`recency`**.

### Strategy: `recency` (default)

Newest claim wins. All conflicting active claims are **superseded**; incoming claim is stored as **active**.

- No `disputes` row is written.
- **Failure mode:** a newer but less trustworthy source (e.g. casual chat) can overwrite an older authoritative fact.

### Strategy: `authority`

Compare **`agent_authority`** weights for the writing agent vs each conflicting claim's `sourceAgent` on that `entity`.

- Incoming agent must be **strictly greater** than **every** conflicting agent's weight → **REPLACE** (supersede conflicts, incoming becomes active).
- Otherwise → **DISPUTE** (see below).

Authority is **not inferred** — it must be seeded manually (see [Authority assignment](#authority-assignment)).

---

## Authority assignment

Table: `agent_authority`

| Column | Meaning |
|--------|---------|
| `agent_id` | Agent identifier |
| `entity` | Exact entity or wildcard pattern (e.g. `user.schedule.*`) |
| `weight` | Trust score `0–1` |

- **Default weight:** `0` if no matching row.
- **Lookup:** `getAuthority(db, agentId, entity)` — exact match beats wildcard; most specific pattern wins.
- **Seeding:** `seedAuthority(db, seeds)` or direct inserts.

Enable authority resolution per entity:

```ts
const memory = new Memory("agent-a", {
  db,
  vectorStore,
  llm,
  embed,
  entityStrategies: { "user.timezone": "authority" },
});
await seedAuthority(db, [
  { entity: "user.timezone", agentId: "agent-a", weight: 0.9 },
  { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
]);
```

Example seed (scheduling vs chat): `EXAMPLE_AUTHORITY_SEED` in `src/resolve.ts`.

---

## When a dispute is written (current behavior)

A row is inserted into **`disputes`** only when **all** of the following are true:

1. `memory.add()` → pass 1 returns **ADD**
2. Pass 2 finds at least one **active** claim from **another agent** on the **same `entity`**
3. Entity strategy is **`authority`** (not `recency`)
4. Writing agent's authority is **not strictly higher** than every conflicting agent (equal or lower weights → `DISPUTE`)

### On `DISPUTE` (`applyCrossAgentResolution`)

| Artifact | Behavior |
|----------|----------|
| **Incoming claim** | Stored with `status: disputed`, **not** indexed in vector store |
| **Incumbent claim(s)** | Remain `active` and searchable |
| **`disputes` row** | Links `claim_a_id` (incoming) and `claim_b_id` (incumbent); `resolved_op` and `resolved_at` are **null** |

**Disputes are not auto-resolved today.** There is no `resolveDispute()` API yet — rows stay open until a future consumer closes them.

### When disputes are **not** written

- Pass 1: `NOOP`, `UPDATE`, or `REPLACE` (pass 2 skipped for non-ADD)
- No cross-agent active claims on the entity
- Strategy is `recency` (always REPLACE, never dispute)
- Strategy is `authority` and incoming agent **strictly beats** all conflicts on weight

---

## Recommended dispute resolution (not implemented)

When authority refuses to guess, prefer **user confirmation** at the app layer:

1. Poll `disputes` where `resolved_at IS NULL`
2. Surface both claims to the user ("Calendar says PST, you said EST — which is right?")
3. Call a future `resolveDispute(disputeId, winningClaimId)` that:
   - Promotes winner to `active` (re-index)
   - Marks loser `superseded`
   - Sets `resolved_op` / `resolved_at` on the dispute row

Avoid jumping to `llm-judge` first for user-facing facts — if authority wouldn't overwrite a trusted claim, another model guess has the same trust problem.

---

## Proposed enhanced auto-resolve rule (design only)

Not in code yet. Combines authority gap, time, and repeat disagreements.

```
delta = weight(incoming, entity) - weight(incumbent, entity)
repeat = disputes between same agent pair on same entity in last 30 days

if repeat >= 2:
  → DISPUTE

if delta >= +0.25:
  → AUTO: incoming REPLACEs incumbent

if delta <= -0.25:
  → AUTO: keep incumbent, reject incoming (no dispute row)

if |delta| < 0.25:
  if incumbent_age > 14 days and incoming is newer:
    → AUTO: incoming REPLACEs (stale refresh)
  else if both claims within 48 hours:
    → DISPUTE
  else:
    → DISPUTE
```

**Trust auto-resolution when:** large authority gap (`|delta| ≥ 0.25`) or stale incumbent, **and** not a repeat fight.

---

## Edge cases

### Cold start (new agent, no authority rows)

- New agent weight = **0** (safe default: not trusted yet).
- vs established agent at `0.9` → incoming loses → **DISPUTE** under authority strategy.
- Do not let undefined authority imply parity with established agents.

### Gaming the repeat-pattern rule

A buggy or adversarial agent can spam conflicting writes to force everything into disputes.

- **What breaks:** disputes table noise and ops burden; search still returns the active incumbent, so retrieval may be fine.
- **Defense (outside conflict policy alone):** rate limits per agent/entity, dedup identical challenged text, circuit-breaker after N disputes, quarantine misbehaving agents at ingestion.

Conflict resolution picks winners; **ingestion guardrails** prevent flooding.

---

## Schema reference

### `claims.status`

- `active` — searchable, canonical memory
- `superseded` — replaced; kept for audit
- `disputed` — challenger parked; not indexed

### `disputes`

| Column | Purpose |
|--------|---------|
| `claim_a_id` | Incoming (disputed) claim |
| `claim_b_id` | Incumbent (active) claim |
| `entity` | Subject of conflict |
| `resolution_strategy` | Strategy that produced the dispute (e.g. `authority`) |
| `resolved_op` | `null` until explicitly resolved |
| `resolved_at` | `null` until explicitly resolved |

---

## Roadmap strategies (not implemented)

- `consensus` — throws "not implemented"
- `llm-judge` — throws "not implemented"; disputes table is intended as input for a future judge or human workflow

---

## Quick decision flow

```
memory.add(fact)
  → pass 1 (own agent)
      NOOP     → stop
      UPDATE/REPLACE → applyOp, stop
      ADD      → pass 2
  → pass 2 (other agents, same entity)
      no conflicts     → ADD
      recency strategy → REPLACE all conflicts, ADD
      authority strategy
        incoming > all → REPLACE, ADD
        else           → DISPUTE row + disputed claim
```
