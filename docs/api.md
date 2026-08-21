# API reference

`vault-memory` public API — npm package entry points and common patterns.

Public README (shipped to npm): [packages/vault-memory/README.md](../packages/vault-memory/README.md)

## Entry points

| Import | Contents |
|--------|----------|
| `vault-memory` | `Memory`, config helpers, classify, resolve, search, vector store |
| `vault-memory/schema` | `claims`, `agentAuthority`, `disputes` Drizzle tables |
| `vault-memory/pg` | `PgVectorStore` |
| `vault-memory/faiss` | `FaissVectorStore` low-level exports |

## Memory class

```typescript
const memory = new Memory(agentId: string, config: MemoryConfig);
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `add` | `(messages, conversationId) → { added: Claim[] }` | Extract → classify → store |
| `search` | `(query, opts?) → ScoredClaim[]` | Semantic search, **scoped to this agent** by default |
| `update` | `(claimId, text) → void` | Re-embed and update own claim |
| `delete` | `(claimId) → void` | Remove own claim + vector |

### `add()` flow

See [Architecture](./architecture.md). Returns array of claims written (empty if all facts were NOOP).

## MemoryConfig

```typescript
interface MemoryConfig {
  db: VaultDb;                    // Required — your Drizzle instance
  apiKey?: string;                // Builds default OpenAI embed + LLM
  embed?: EmbedFn;                // Override embedding function
  llm?: LLMFn;                    // Override LLM (extract + classify)
  model?: string;                 // Default chat model override
  embeddingModel?: string;        // Default embedding model override
  vectorStore?: VectorStore;      // Default: FaissVectorStore
  vectorDimensions?: number;      // Default: 1536
  entityStrategies?: Partial<Record<string, ResolutionStrategy>>;
}
```

`ResolutionStrategy`: `"recency" | "authority" | "consensus" | "llm-judge"` (last two throw if used).

## Cross-agent search

`memory.search()` filters to the constructing agent's `sourceAgent`. For search across all agents:

```typescript
import { search, resolveEmbed, resolveVectorStore } from "vault-memory";

const vectorStore = resolveVectorStore({ db });
const embed = resolveEmbed({ apiKey: process.env.OPENAI_API_KEY });

const results = await search(db, vectorStore, embed, "what timezone?", {
  status: "active",
  limit: 10,
});
```

CLI demo uses this via `searchSharedStore()` in `apps/cli-agent/src/memory-setup.ts`.

## Authority helpers

```typescript
import {
  seedAuthority,
  getAuthority,
  EXAMPLE_AUTHORITY_SEED,
  strategyForEntity,
} from "vault-memory";

await seedAuthority(db, [
  { entity: "user.timezone", agentId: "agent-a", weight: 0.9 },
  { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
]);
```

## Vector store helpers

```typescript
import {
  resolveVectorStore,
  createDefaultVectorStore,
  MemoryVectorStore,
  FaissVectorStore,
} from "vault-memory";

const vectorStore = resolveVectorStore({ db, vectorDimensions: 1536 });
await vectorStore.rebuild(db);
```

## Lower-level exports (advanced)

| Export | Use |
|--------|-----|
| `extractFacts` | Custom pipelines without full `Memory.add` |
| `classifyAgainstOwnHistory` | Custom classify flow |
| `classifyAgainstOtherAgents` | Custom cross-agent flow |
| `resolveConflict` | Test / extend resolution strategies |
| `applyOp` / `applyCrossAgentResolution` | Direct op application |
| `recencyWeightedScore` | Decay scoring |

## Types

```typescript
type ClaimStatus = "active" | "superseded" | "disputed";
type ClaimType = "semantic" | "episodic";
type ClaimOp = "ADD" | "UPDATE" | "REPLACE" | "NOOP";

interface ExtractedFact {
  entity: string;
  text: string;
  type: ClaimType;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
```

## Multi-agent setup checklist

1. Create/migrate all three tables — [Schema](./schema.md)
2. `seedAuthority(db, seeds)` for entities that need domain trust
3. Set `entityStrategies: { "user.timezone": "authority" }` per entity
4. Share one `vectorStore` instance per process, or use `PgVectorStore`
5. Call `vectorStore.rebuild(db)` before ops when other processes may have written — [Vector store](./vector-store.md)

## What the CLI does not expose

| API | Covered by |
|-----|------------|
| `memory.update` | Unit tests (`memory.test.ts`) |
| `memory.delete` | Unit tests |
| Per-agent `memory.search` | Unit tests — CLI uses cross-agent `search` only |

## Related

- [Entities](./entities.md) — what `entity` strings mean
- [Multi-agent conflict](./multi-agent-conflict.md) — strategy behavior
- [CLI demo](./cli-demo.md) — hands-on usage
