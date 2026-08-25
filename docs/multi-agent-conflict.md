# Multi-agent conflict resolution

How Vault handles conflicting claims across agents. Documents **current behavior** in code.

**Key code:** `packages/vault-memory/src/memory.ts`, `classify.ts`, `resolve.ts`, `ops.ts`, `db/schema.ts`

**Tests:** `test/multi-agent-conflict.test.ts`, `test/classify-two-pass.test.ts`, `test/resolve.test.ts`

Package copy (same content): [packages/vault-memory/docs/multi-agent-conflict.md](../packages/vault-memory/docs/multi-agent-conflict.md)

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

Pass 2 is skipped when pass 1 is `UPDATE`, `REPLACE`, or `NOOP`.

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
- Otherwise → **DISPUTE**.

Authority is **not inferred** — it must be seeded manually. See [Authority assignment](#authority-assignment).

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

```typescript
const memory = new Memory("agent-a", {
  db,
  vectorStore,
  apiKey: process.env.OPENAI_API_KEY,
  entityStrategies: { "user.timezone": "authority" },
});

await seedAuthority(db, [
  { entity: "user.timezone", agentId: "agent-a", weight: 0.9 },
  { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
]);
```

Example seed (scheduling vs chat): `EXAMPLE_AUTHORITY_SEED` in `src/resolve.ts`.

Without `agent_authority` rows, everything silently falls back to **recency**.

---

## When a dispute is written

A row is inserted into **`disputes`** only when **all** of the following are true:

1. `memory.add()` → pass 1 returns **ADD**
2. Pass 2 finds at least one **active** claim from **another agent** on the **same `entity`**
3. Entity strategy is **`authority`** (not `recency`)
4. Writing agent's authority is **not strictly higher** than every conflicting agent

### On `DISPUTE`

| Artifact | Behavior |
|----------|----------|
| **Incoming claim** | Stored with `status: disputed`, **not** indexed in vector store |
| **Incumbent claim(s)** | Remain `active` and searchable |
| **`disputes` row** | Links `claim_a_id` (incoming) and `claim_b_id` (incumbent); `resolved_op` and `resolved_at` are **null** |

**Disputes are not auto-resolved today.** There is no `resolveDispute()` API yet.

### When disputes are **not** written

- Pass 1: `NOOP`, `UPDATE`, or `REPLACE`
- No cross-agent active claims on the entity
- Strategy is `recency`
- Strategy is `authority` and incoming agent **strictly beats** all conflicts

---

## Classic demo scenario

| Step | Agent | Input | Result |
|------|-------|-------|--------|
| 1 | agent-a (weight 0.9 on timezone) | "I'm in PST" | Active PST claim |
| 2 | agent-b (weight 0.2) | "I'm in EST" | **Disputed** EST claim |
| 3 | Search | "what timezone?" | Returns agent-a PST |

CLI walkthrough: [CLI demo](./cli-demo.md).

---

## Edge cases

### Cold start (new agent, no authority rows)

- New agent weight = **0**
- vs established agent at `0.9` → incoming loses → **DISPUTE** under authority strategy

### Entity mismatch

If agents extract different entities (`user.timezone` vs `user.location`), no cross-agent conflict triggers. See [Entities](./entities.md).

### Gaming / spam disputes

Conflict resolution picks winners; **ingestion guardrails** (rate limits, dedup) are an app-layer concern.

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
| `resolution_strategy` | Strategy that produced the dispute |
| `resolved_op` | `null` until explicitly resolved |
| `resolved_at` | `null` until explicitly resolved |

---

## Roadmap (not implemented)

- `consensus` — throws "not implemented"
- `llm-judge` — throws "not implemented"
- `resolveDispute()` — human or app-layer workflow
- Enhanced auto-resolve rules (authority gap + time + repeat disagreements) — design only in package docs

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
