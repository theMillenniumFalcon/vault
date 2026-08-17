# vault-memory

Agent-attributed memory layer for AI agents — extract, store, retrieve, and resolve conflicts when multiple agents write to the same store.

## Install

```bash
npm install vault-memory drizzle-orm better-sqlite3
```

`faiss-node` is installed automatically as a dependency of `vault-memory` for FAISS vector search. You bring your own Drizzle database driver (`better-sqlite3`, `bun:sqlite`, `postgres.js`, etc.). `drizzle-orm` is a peer dependency.

On Bun, if the `faiss-node` postinstall is blocked:

```bash
bun pm trust faiss-node
bun install
```

## Upgrading from v0.1.x

v0.2.0 adds multi-agent tables. Existing `claims` rows remain valid — upgrade is additive at the data level.

```bash
npm install vault-memory@latest
npx drizzle-kit generate   # picks up agentAuthority + disputes from vault-memory/schema
npx drizzle-kit push
```

Import the new tables for migrations:

```javascript
import { claims, agentAuthority, disputes } from "vault-memory/schema";
```

FAISS remains the default vector backend; you do not need to pass `vectorStore` explicitly. If native bindings are a problem, opt out:

```javascript
import { Memory, MemoryVectorStore } from "vault-memory";

const memory = new Memory("agent-a", {
  db,
  vectorStore: new MemoryVectorStore(),
  apiKey: process.env.OPENAI_API_KEY,
});
```

## Quickstart (single agent)

```javascript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Memory } from "vault-memory";

const sqlite = new Database(":memory:");
sqlite.exec(`
  CREATE TABLE claims (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    source_agent TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'active',
    supersedes TEXT,
    embedding TEXT,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER
  )
`);

const db = drizzle(sqlite);
const memory = new Memory("agent-a", {
  db,
  apiKey: process.env.OPENAI_API_KEY,
});

const { added } = await memory.add(
  [{ role: "user", content: "I'm vegetarian" }],
  "conversation-1",
);
console.log(added);

const results = await memory.search("what does the user eat?");
console.log(results);
```

## Multi-agent quickstart

Two agents sharing one database file. Each process holds its own FAISS index — call `vectorStore.rebuild(db)` before reads/writes when another process may have written claims (see `search` import below).

```javascript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  Memory,
  seedAuthority,
  EXAMPLE_AUTHORITY_SEED,
  resolveVectorStore,
  search,
  resolveEmbed,
} from "vault-memory";

// Create claims + agent_authority + disputes tables (or use Drizzle migrations)
const sqlite = new Database("shared.db");
// ... run migrations ...

const db = drizzle(sqlite);
await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);

const vectorStore = resolveVectorStore({ db });
const embed = resolveEmbed({ apiKey: process.env.OPENAI_API_KEY });

const memoryA = new Memory("agent-a", {
  db,
  vectorStore,
  apiKey: process.env.OPENAI_API_KEY,
  entityStrategies: { "user.timezone": "authority" },
});

await memoryA.add([{ role: "user", content: "I'm in PST" }], "conv1");

// Second agent (separate process or script): rebuild index, then write
await vectorStore.rebuild(db);
const memoryB = new Memory("agent-b", {
  db,
  vectorStore,
  apiKey: process.env.OPENAI_API_KEY,
  entityStrategies: { "user.timezone": "authority" },
});

const { added } = await memoryB.add(
  [{ role: "user", content: "I'm in EST" }],
  "conv1",
);
// Lower authority → claim stored as disputed
console.log(added[0]?.status); // "disputed"

await vectorStore.rebuild(db);
const results = await search(
  db,
  vectorStore,
  embed,
  "what timezone is the user in?",
  { status: "active", limit: 5 },
);
console.log(results[0]?.sourceAgent); // "agent-a"
console.log(results[0]?.text);        // contains "PST"
```

### Authority seeding (required for authority strategy)

Without `agent_authority` rows, cross-agent conflicts fall back to **recency** (newest claim wins). For domain-specific trust (e.g. scheduling agent owns timezones), seed weights:

```javascript
import { seedAuthority } from "vault-memory";

await seedAuthority(db, [
  { entity: "user.timezone", agentId: "agent-a", weight: 0.9 },
  { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
  { entity: "user.mood", agentId: "agent-b", weight: 0.8 },
  { entity: "user.mood", agentId: "agent-a", weight: 0.3 },
]);
```

Use `entityStrategies: { "user.timezone": "authority" }` on `Memory` config to enable authority resolution for that entity. `EXAMPLE_AUTHORITY_SEED` is exported for demos.

## Configuration

```typescript
interface MemoryConfig {
  db: VaultDb;           // your Drizzle instance — any SQLite/Postgres driver
  vectorStore?: VectorStore; // defaults to FaissVectorStore (FAISS)
  vectorDimensions?: number; // for default FAISS index; default 1536 (text-embedding-3-small)
  embed?: EmbedFn;       // defaults to OpenAI text-embedding-3-small when apiKey is set
  llm?: LLMFn;           // defaults to OpenAI gpt-4o-mini when apiKey is set
  apiKey?: string;       // convenience: builds default embed + llm if not overridden
  model?: string;        // override default chat model
  embeddingModel?: string; // override default embedding model
  entityStrategies?: Partial<Record<string, ResolutionStrategy>>;
}
```

Override `embed` and `llm` to use OpenRouter, Anthropic, or a local model instead of OpenAI.

### Vector store backends

| Backend | When to use |
|---------|-------------|
| **`FaissVectorStore`** (default) | Local dev, single-machine multi-agent. Created via `resolveVectorStore()` or omit `vectorStore`. |
| **`MemoryVectorStore`** | Tests, CI, or environments that cannot load `faiss-node`. |
| **`PgVectorStore`** (`vault-memory/pg`) | Postgres + `pgvector` — shared index across processes, preferred at scale. |

Claim rows in SQL are canonical; the vector store is an index. If it drifts, call `vectorStore.rebuild(db)`.

## API

```typescript
const memory = new Memory("agent-a", config);

await memory.add(messages, conversationId);  // extract → classify → store
await memory.search(query, opts?);           // semantic search (scoped to this agent)
await memory.update(claimId, text);          // re-embed and update
await memory.delete(claimId);                // remove claim
```

Cross-agent search (all agents): import `search` from `vault-memory` and pass `db`, `vectorStore`, and `embed` — see multi-agent quickstart above.

## Conflict resolution

| Strategy | Behavior |
|----------|----------|
| **`recency`** (default) | Newest claim supersedes conflicting active claims from other agents |
| **`authority`** | Incoming agent must beat every conflicting agent's weight on that entity; else **DISPUTE** |

Open disputes are recorded in the `disputes` table for audit.

## License

MIT
