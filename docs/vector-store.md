# Vector store

How Vault indexes embeddings for semantic search.

## Design principle

**SQL claim rows are canonical.** The vector store is a search index. Embeddings are stored in `claims.embedding` (JSON) and mirrored in the index for fast top-k retrieval.

If the index drifts (multi-process writes, crash, manual DB edits), call `vectorStore.rebuild(db)`.

## Backends

| Backend | Export | When to use |
|---------|--------|-------------|
| **`FaissVectorStore`** | `vault-memory` (default) | Local dev, single-machine multi-agent |
| **`MemoryVectorStore`** | `vault-memory` | Tests, CI, no native deps |
| **`PgVectorStore`** | `vault-memory/pg` | Postgres + `pgvector`, shared across processes |

### FaissVectorStore (default)

- Uses `faiss-node` native binding
- `IndexFlatIP` — exact inner-product on L2-normalized vectors
- O(n) but fast native C++
- **Per-process** — each agent holds its own in-memory index

Created automatically via `resolveVectorStore()` or when `vectorStore` is omitted from `MemoryConfig`.

On Bun, if postinstall is blocked:

```bash
bun pm trust faiss-node
bun install
```

### MemoryVectorStore (opt-out)

- Pure JS brute-force cosine similarity
- No native dependencies
- Used in `verify:consumer` scratch tests when FAISS bindings fail
- Good for unit tests and tiny harnesses

```typescript
import { Memory, MemoryVectorStore } from "vault-memory";

const memory = new Memory("agent-a", {
  db,
  vectorStore: new MemoryVectorStore(),
  apiKey: process.env.OPENAI_API_KEY,
});
```

### PgVectorStore (Postgres)

- Embeddings in `pgvector` column
- Filters push down to SQL
- **Shared index** — no per-process rebuild needed
- Preferred when multiple writers outgrow SQLite

```typescript
import { PgVectorStore } from "vault-memory/pg";
```

Not exercised by the CLI demo — requires Postgres setup.

## Interface

```typescript
interface VectorStore {
  upsert(id: string, embedding: number[], meta: VectorFilter & { claimId: string }): Promise<void>;
  remove(id: string): Promise<void>;
  search(
    embedding: number[],
    opts: { limit: number; filter?: VectorFilter },
  ): Promise<Array<{ claimId: string; score: number }>>;
  rebuild(db: VaultDb): Promise<void>;
}
```

`VectorFilter` supports: `sourceAgent`, `excludeAgent`, `entity`, `status`, `conversationId`.

## Lifecycle sync

Every claim write must sync the index in the same logical operation:

| Op | Vector store action |
|----|---------------------|
| ADD / UPDATE / REPLACE | `upsert` |
| DELETE | `remove` |
| REPLACE (superseded claim) | `remove` superseded ID |
| DISPUTE (incoming) | **not indexed** — disputed claims excluded from active search |

Implemented in `src/ops.ts` and `syncClaimVectorFromRow`.

## Multi-process pattern (shared SQLite)

```
Process A                    Process B
  │                            │
  ├─ write claim to DB         │
  │                            ├─ rebuild(db)  ← see other agent's rows
  │                            ├─ write claim
  ├─ rebuild(db)               │
  ├─ read/search               │
```

CLI demo: `syncVectorIndex()` in `apps/cli-agent/src/memory-setup.ts` calls `vectorStore.rebuild(db)` before each operation.

**Without rebuild**, agent B's FAISS index won't see agent A's claims even though they're in SQLite.

## Search pipeline

1. Embed query text
2. `vectorStore.search(embedding, { limit, filter })` → claim IDs + scores
3. Hydrate rows from SQL
4. Apply recency decay (`recencyWeightedScore`) — does not mutate stored confidence
5. Bump `lastAccessedAt` on returned claims
6. Re-sort by decayed score

## Configuration

```typescript
interface MemoryConfig {
  vectorStore?: VectorStore;      // default: FaissVectorStore
  vectorDimensions?: number;      // default 1536 (text-embedding-3-small)
}
```

If using custom embed dimensions, set `vectorDimensions` to match.

## Testing

- Unit tests inject a **pure-JS FAISS shim** (`test/helpers/pure-js-faiss.ts`) so CI doesn't require native builds
- Conflict harness runs against `FaissVectorStore` with shim
- `MemoryVectorStore` covered as legacy fallback smoke test
- `PgVectorStore` — optional when Postgres is in harness

## Future (not shipped)

Approximate FAISS indexes (IVF/HNSW) — deferred until profiling shows search latency at 10k+ claims. Flat index affects classify/conflict outcomes via recall.

## Related

- [Architecture](./architecture.md) — where vector store fits in the pipeline
- [Manual testing](./manual-testing.md) — Test F (restart agent, verify rebuild)
