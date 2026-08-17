# vault-memory

## 0.2.0

### Minor Changes

- **Breaking schema change — upgrade requires new tables.**

  Multi-agent memory layer: cross-agent classification, conflict resolution (`recency` / `authority`), and dispute audit trail.

  ### Schema (migration required)

  New Drizzle tables exported from `vault-memory/schema`:

  - `agent_authority` — per-agent trust weights per entity (required for authority strategy)
  - `disputes` — audit trail when conflicts cannot be auto-resolved

  Existing `claims` rows are valid as-is; no data migration needed. Run Drizzle migrations after upgrading:

  ```bash
  npm install vault-memory@0.2.0
  npx drizzle-kit generate   # picks up agentAuthority + disputes from vault-memory/schema
  npx drizzle-kit push
  ```

  ### Vector search

  - **Default:** `FaissVectorStore` via `faiss-node` (native binding, installed automatically)
  - **Opt out:** `vectorStore: new MemoryVectorStore()` for zero native deps
  - **Postgres:** `PgVectorStore` from `vault-memory/pg` when using `pgvector`

  New optional config: `vectorStore`, `vectorDimensions`, `entityStrategies`.

  ### Multi-agent setup

  Seed `agent_authority` (`seedAuthority`) and set `entityStrategies` for entities where authority should apply; otherwise conflicts fall back to `recency`.
