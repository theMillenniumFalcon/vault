# vault-memory

## 1.0.0

### Major Changes

- Minor changes
  Pass 2 no longer treats every other agent's claim on the same entity as a conflict. Vault loads those active claims from SQL, then one model call labels each row:

  equivalent — the fact is already stored, so nothing is written.
  compatible — both can be true, so the new claim is stored and the others stay active.
  contradicts — they cannot both be true, so only those rows go through recency or authority.
  recency supersedes the contradicting rows. authority still disputes when the incoming agent is not strictly heavier. Compatible rows on that entity are left alone. No new tables are required. Existing claims, agent_authority, and disputes rows stay valid.

  The CLI review is not part of this package. In apps/cli-agent, a disputed claim now asks you to pick 1 or 2, and /resolve reopens that choice later.

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
