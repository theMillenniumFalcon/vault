# Full pipeline reference

End-to-end flow for `Memory.add()` and `Memory.search()` in `vault-memory`. This is the canonical reference — it includes entity resolution (P0–P3) layered on top of the original classify / supersede / dispute logic.

**Entry point:** `packages/vault-memory/src/memory.ts`

---

## Overview diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Memory.add(messages)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. EXTRACT          extractFacts() — LLM, latest user turn only         │
│    [optional]       registry-constrained prompt if useEntityRegistry    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          for each ExtractedFact
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. EMBED            embed(fact.text) → vector                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. RESOLVE ENTITY   resolveEntity() — align label with similar claims   │
│    [optional]       LLM disambiguation in borderline similarity band   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. REGISTRY CHECK   ensureEntityInRegistry() if useEntityRegistry       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. PASS 1           classifyAgainstOwnHistory() — same agent            │
│                     vector search (own claims) + LLM → op               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                 NOOP          UPDATE/REPLACE        ADD
                    │               │               │
                    ▼               ▼               ▼
                 [stop]      applyOp()      ┌──────────────┐
                    │        (skip pass 2)  │ 6. PASS 2    │
                    │                       │ cross-agent  │
                    │                       └──────┬───────┘
                    │                              │
                    │              ┌───────────────┼───────────────┐
                    │              │               │               │
                    │            no conflict    recency/authority   │
                    │              │               │               │
                    │              ▼               ▼               ▼
                    │           ADD          REPLACE+supersede   DISPUTE
                    │                              │               │
                    └──────────────────────────────┴───────────────┘
                                                   │
                                                   ▼
                              write claim row + sync vector index
```

---

## `Memory.add()` — step by step

### Step 1: Extract facts

**Code:** `src/extract.ts` → `extractFacts()`

**Input:** Conversation messages (only the **latest user turn** + following assistant messages are used).

**Output:** Array of `{ entity, text, type }` where `type` is `semantic` or `episodic`.

**Default mode:** LLM invents a dotted-path `entity` string guided by prompt examples (`user.diet`, `user.timezone`, etc.). No fixed enum.

**Registry mode** (`useEntityRegistry: true`):

- Prompt includes known keys from the `entities` table.
- LLM must pick an existing key or use `new:user.<domain>` for new subjects.
- Post-validation rejects unknown keys without `new:` and keys failing `entityKeyPattern`.

See [Entities](./entities.md).

---

### Step 2: Embed

**Code:** `src/embed.ts` → `resolveEmbed(config)`

Embeds `fact.text` into a vector (default: OpenAI `text-embedding-3-small`, 1536 dims). Same vector is reused for entity resolution and classification.

---

### Step 3: Resolve entity (P0 + P1)

**Code:** `src/resolve-entity.ts` → `resolveEntity()`

Aligns the extracted `entity` string with existing **claims** when fact text is semantically similar — fixes LLM label drift (`user.abc` vs `user.timezone`).

| Similarity score | Behavior |
|------------------|----------|
| **≥ 0.85** (`entityMatchThreshold`) | Auto-align to incumbent claim's entity |
| **0.70 – 0.85** | Optional LLM disambiguation (`entityResolutionUseLlm`) |
| **< 0.70** (`entityDisambiguationThreshold`) | Keep extracted entity |

Search is global across all active claims (no `sourceAgent` filter). Uses raw vector scores (no recency decay).

Disable entirely: `entityMatchThreshold: 0` or custom `resolveEntity` hook.

---

### Step 4: Registry check (P2, optional)

**Code:** `src/entity-registry.ts` → `ensureEntityInRegistry()`

Only when `useEntityRegistry: true`.

- Validates entity key against pattern (default: `user.<dotted.path>`).
- Auto-registers new keys on first use if `entityRegistryAutoRegister` is true (default).
- Throws if key is invalid or unregistered when auto-register is off.

---

### Step 5: Pass 1 — classify against own history

**Code:** `src/classify.ts` → `classifyAgainstOwnHistory()`

1. Vector search: top-5 similar **active** claims from **this agent only** (`searchOwnClaims`).
2. LLM classifies relationship:

| Op | Meaning | Pass 2? | DB effect |
|----|---------|---------|-----------|
| `NOOP` | Already known | — | Nothing written |
| `UPDATE` | Refines wording | Skipped | Update row in place; **entity preserved** from target claim |
| `REPLACE` | Contradicts own prior claim | Skipped | Old claim → `superseded`; new active claim with `supersedes` link |
| `ADD` | Genuinely new for this agent | **Runs pass 2** | — |

**Code:** `src/ops.ts` → `applyOp()` for UPDATE / REPLACE / ADD (from pass 1 only when not going to pass 2).

---

### Step 6: Pass 2 — classify against other agents

**Code:** `src/classify.ts` → `classifyAgainstOtherAgents()`

Runs **only when pass 1 returned `ADD`**.

1. Vector search: active claims on the **exact same entity** from **other agents** (`excludeAgent`).
2. No conflicts → cross-agent `ADD`.
3. Conflicts → `strategyForEntity(entity, config)`:

| Strategy | Source | Behavior |
|----------|--------|----------|
| `recency` | Default | Newest claim wins — supersede all conflicting active claims |
| `authority` | `entityStrategies` + `agent_authority` table | Incoming agent must beat every conflicting agent's weight; else `DISPUTE` |

**Strategy lookup (P3):** `entityStrategies` supports wildcards (`user.schedule.*`). Most specific pattern wins — same rules as `getAuthority()`.

**Code:** `src/resolve.ts` → `resolveConflict()`

---

### Step 7: Apply cross-agent resolution

**Code:** `src/ops.ts` → `applyCrossAgentResolution()`

| Resolution op | Claim written | Incumbent claim(s) | `disputes` row | Vector index |
|---------------|---------------|--------------------|----------------|--------------|
| `ADD` | New `active` | — | — | Upsert |
| `REPLACE` | New `active` | `superseded` | — | Remove old, upsert new |
| `DISPUTE` | New `disputed` | Stay `active` | Inserted | **Not indexed** (disputed) |

Every write syncs the vector store in the same logical operation. SQL claim rows are canonical.

See [Multi-agent conflict](./multi-agent-conflict.md).

---

## Worked example: timezone authority conflict

**Setup:**

```typescript
await seedEntities(db, EXAMPLE_ENTITY_SEED);
await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);

const config = {
  db,
  useEntityRegistry: true,
  entityStrategies: { "user.timezone": "authority" },
};
```

**Step A — agent-a** says: *"I'm in PST"*

| Step | Result |
|------|--------|
| Extract | `{ entity: "user.timezone", text: "The user is in PST" }` |
| Resolve entity | No similar claims → unchanged |
| Registry | `user.timezone` exists |
| Pass 1 | `ADD` (no own history) |
| Pass 2 | No other agents → `ADD` |
| **Stored** | `active` claim, agent-a, entity `user.timezone` |

**Step B — agent-b** says: *"I'm in EST"*

| Step | Result |
|------|--------|
| Extract | `{ entity: "user.wrong_label", text: "The user is in EST" }` (LLM drift) |
| Resolve entity | Similar to agent-a's PST claim → **`user.timezone`** |
| Registry | `user.timezone` exists |
| Pass 1 | `ADD` (no own history) |
| Pass 2 | Finds agent-a on `user.timezone`; authority: agent-b (0.2) ≤ agent-a (0.9) |
| **Stored** | `disputed` claim, agent-b; `disputes` row links both claims |

**Search** (cross-agent, active only): returns agent-a's PST claim.

---

## Worked example: same-agent supersede (diet change)

**Agent-a only**, no registry, default recency.

1. *"I'm vegetarian"* → extract `user.diet` → pass 1 `ADD` → stored `active`.
2. *"I eat meat now"* → extract `user.diet` → pass 1 finds similar own claim → LLM `REPLACE` → old claim `superseded`, new `active` with `supersedes` link. **Pass 2 skipped.**

---

## Worked example: recency cross-agent (no authority)

**Agent-a:** *"I love Italian food"* → `user.diet`, `active`.

**Agent-b:** *"I hate Italian food"* → `user.diet`, pass 2 recency (no authority on diet) → agent-a `superseded`, agent-b `active`. No dispute row.

---

## `Memory.search()` pipeline

**Code:** `src/search.ts`

```
query text
  → embed(query)
  → vectorStore.search(embedding, { sourceAgent: this agent, status: active })
  → hydrate claim rows from SQL
  → recencyWeightedScore() — decay by lastAccessedAt (does not mutate confidence)
  → bump lastAccessedAt on returned claims
  → re-sort by decayed score
```

Cross-agent search: use exported `search(db, vectorStore, embed, query, opts)` without `sourceAgent` filter.

See [Vector store](./vector-store.md).

---

## Claim status lifecycle

```
                    ┌──────────┐
         ADD ──────▶│  active  │◀──── search returns these
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
      REPLACE         DISPUTE      (unchanged)
    (superseded)    (disputed)
           │             │
           ▼             ▼
    ┌────────────┐ ┌────────────┐
    │ superseded │ │  disputed  │  ← not in vector index
    └────────────┘ └────────────┘
```

---

## Config reference (pipeline-related)

| Option | Stage | Default |
|--------|-------|---------|
| `apiKey` / `llm` / `embed` | Extract, classify, disambiguation | OpenAI when `apiKey` set |
| `useEntityRegistry` | Extract + registry check | `false` |
| `entityRegistryAutoRegister` | Registry check | `true` |
| `entityKeyPattern` | Registry validation | `user.<dotted>` |
| `entityMatchThreshold` | Resolve entity | `0.85` (`0` = disable) |
| `entityDisambiguationThreshold` | Resolve entity LLM band | `0.70` |
| `entityResolutionUseLlm` | Borderline disambiguation | `true` |
| `resolveEntity` | Override entity resolution | built-in |
| `entityStrategies` | Pass 2 strategy (exact or wildcard) | `recency` |
| `vectorStore` | Embed sync, search | `FaissVectorStore` |

---

## What is unchanged from Phase 1 / 2

The entity work (P0–P3) is **additive** — it runs before classify and does not replace:

- Two-pass classification (own history → cross-agent)
- `ADD` / `UPDATE` / `REPLACE` / `NOOP` ops
- Superseding (`status: superseded`, `supersedes` link, vector removal)
- Recency and authority conflict strategies
- `disputes` audit table on authority loss
- FAISS vector index sync on every write
- Search-time recency decay

---

## Key source files

| Stage | File |
|-------|------|
| Orchestration | `src/memory.ts` |
| Extract | `src/extract.ts` |
| Entity resolve | `src/resolve-entity.ts` |
| Entity registry | `src/entity-registry.ts` |
| Classify | `src/classify.ts` |
| Conflict policy | `src/resolve.ts` |
| Writes + index sync | `src/ops.ts` |
| Search | `src/search.ts` |
| Decay | `src/decay.ts` |
| Schema | `src/db/schema.ts` |

---

## Related docs

- [Entities](./entities.md) — how entity strings are chosen and aligned
- [Multi-agent conflict](./multi-agent-conflict.md) — pass 2 strategies and disputes
- [Architecture](./architecture.md) — components and multi-process layout
- [API reference](./api.md) — `Memory` public surface
