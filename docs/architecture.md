# Architecture

How Vault's memory pipeline works from message to stored claim.

## Components

| Component | Location | Role |
|-----------|----------|------|
| `Memory` | `packages/vault-memory/src/memory.ts` | Public API — add, search, update, delete |
| `extractFacts` | `src/extract.ts` | LLM pulls structured facts from latest turn |
| `classify` | `src/classify.ts` | Two-pass: own history → cross-agent |
| `resolve` | `src/resolve.ts` | Recency / authority strategies |
| `ops` | `src/ops.ts` | Write claim rows + sync vector index |
| `search` | `src/search.ts` | Embed query → vector search → hydrate + decay |
| Vector store | `src/vector-store/` | FAISS (default), MemoryVectorStore, PgVectorStore |
| Schema | `src/db/schema.ts` | `claims`, `agent_authority`, `disputes`, `entities` |

## `Memory.add()` pipeline

Full step-by-step reference with diagrams and worked examples: **[Pipeline](./pipeline.md)**.

Summary:

```
messages
  → extractFacts (LLM, latest user turn only)
  → embed (per fact)
  → resolveEntity (align entity label — optional similarity + LLM)
  → ensureEntityInRegistry (optional, useEntityRegistry)
  → classifyAgainstOwnHistory (vector search + LLM → ADD | UPDATE | REPLACE | NOOP)
  → if ADD: classifyAgainstOtherAgents (entity-scoped cross-agent search + strategy)
  → apply op (write claim row + sync vector index)
```

### Pass 1 — same agent

Vector search finds top similar **active** claims from the **writing agent**. An LLM decides:

| Op | Meaning |
|----|---------|
| `ADD` | New information |
| `UPDATE` | Refines existing claim without contradicting |
| `REPLACE` | Contradicts own prior claim |
| `NOOP` | Already known — nothing written |

If `NOOP`, processing stops for that fact. If `UPDATE` or `REPLACE`, pass 2 is **skipped**.

### Pass 2 — other agents

Runs **only when pass 1 returns `ADD`**.

1. Search for **active** claims on the **same entity** from **other** agents
2. No conflicts → store as `ADD`
3. Conflicts → apply `entityStrategies[entity]` or default **`recency`**

See [Multi-agent conflict](./multi-agent-conflict.md) for strategy details.

## Data layers

| Layer | Technology | Role |
|-------|------------|------|
| **Canonical storage** | SQLite or Postgres via Drizzle | Claim rows + JSON embeddings |
| **Search index (default)** | `FaissVectorStore` | Per-process FAISS `IndexFlatIP` |
| **Legacy opt-out** | `MemoryVectorStore` | In-process JS brute-force cosine |
| **Postgres path** | `PgVectorStore` | Shared `pgvector` index |

**Rule:** SQL claim rows are source of truth. The vector store is an index. If it drifts, `vectorStore.rebuild(db)`.

## Multi-process architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Agent process (agent-a, agent-b, …)                        │
│  ┌─────────────┐    ┌──────────────────┐                    │
│  │   Memory    │───▶│ FaissVectorStore │  (per-process)    │
│  └──────┬──────┘    └────────┬─────────┘                    │
│         │ extract/classify   │ rebuild / upsert             │
└─────────┼────────────────────┼──────────────────────────────┘
          │                    │
          ▼                    ▼
   ┌──────────────────────────────────────┐
   │  Shared DB (SQLite file or Postgres) │
   │  claims · agent_authority · disputes · entities │
   └──────────────────────────────────────┘
```

Each agent process holds its own FAISS index. When sharing a SQLite file (CLI demo), call `vectorStore.rebuild(db)` before reads/writes so the index sees other agents' claims. The CLI does this via `syncVectorIndex()` in `apps/cli-agent/src/memory-setup.ts`.

## Search

`memory.search(query)`:

1. Embed the query
2. Vector store returns top-k claim IDs + scores
3. Hydrate full rows from SQL
4. Apply **recency decay** at query time (`recencyWeightedScore`)
5. Bump `lastAccessedAt` on returned claims (stored `confidence` is not mutated)

Cross-agent search: use the exported `search(db, vectorStore, embed, query, opts)` function (no `sourceAgent` filter).

## Claim lifecycle

| Status | Meaning |
|--------|---------|
| `active` | Current truth, indexed, searchable |
| `superseded` | Replaced by newer claim, kept for audit |
| `disputed` | Challenger parked when authority can't pick a winner; **not indexed** |

## What's not built yet

- Enhanced auto-resolve rules (authority gap + time + repeat disagreements) — design only
- Approximate FAISS indexes (IVF/HNSW) — not needed until 10k+ claims

## Key code entry points

| Task | Start here |
|------|------------|
| Trace add flow | `src/memory.ts` → `add()` |
| Change extraction prompt | `src/extract.ts` |
| Change classify logic | `src/classify.ts` |
| Change conflict policy | `src/resolve.ts` |
| Change vector backends | `src/vector-store/` |
| Multi-agent demo wiring | `apps/cli-agent/src/memory-setup.ts` |
