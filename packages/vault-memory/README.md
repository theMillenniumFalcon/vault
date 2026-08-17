# vault-memory

Agent-attributed memory layer for AI agents — extract, store, retrieve, and detect contradictions in conversation facts.

**Single-agent today.** Multi-agent conflict resolution is planned for a future release. Every claim is stored with a `sourceAgent` field, but cross-agent comparison is not implemented yet.

## Install

```bash
npm install vault-memory drizzle-orm better-sqlite3
```

`faiss-node` is installed automatically as a dependency of `vault-memory` for FAISS vector search. You bring your own Drizzle database driver (`better-sqlite3`, `bun:sqlite`, `postgres.js`, etc.). `drizzle-orm` is a peer dependency.

## Quickstart

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

For migrations, import the schema subpath:

```javascript
import { claims } from "vault-memory/schema";
```

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

## API

```typescript
const memory = new Memory("agent-a", config);

await memory.add(messages, conversationId);  // extract → classify → store
await memory.search(query, opts?);           // semantic search (scoped to this agent)
await memory.update(claimId, text);          // re-embed and update
await memory.delete(claimId);                // remove claim
```

## Roadmap

- **v0.1 (now):** Single-agent memory with ADD / UPDATE / REPLACE / NOOP and semantic search
- **Future:** Multi-agent conflict resolution using the `sourceAgent` and `disputed` status fields already in the schema

See **[docs/multi-agent-conflict.md](./docs/multi-agent-conflict.md)** for how multi-agent conflict resolution works today (two-pass classifier, recency vs authority, disputes).

## License

MIT
