# Vault

Agent-attributed memory for AI agents — extract facts from conversation, store them with semantic search, detect contradictions, and resolve conflicts when multiple agents write to the same store.

The core library [`vault-memory`](./packages/vault-memory) is designed to publish on npm. You bring your own database (Drizzle + SQLite or Postgres); Vault brings extraction, classification, FAISS vector search, and multi-agent conflict policy.

**Team docs:** [docs/onboarding.md](./docs/onboarding.md) (start here) · [docs/](./docs/) (full index)

---

## Why Vault

Most agent memory libraries treat memory as a single writer with last-write-wins semantics. Vault is built for **multiple independent agents** (scheduling, chat, tools, etc.) sharing one store:

- Every fact is a **claim** with `sourceAgent`, `entity`, `status`, and an audit-friendly history (`supersedes`, `disputed`).
- **Two-pass classification** reconciles within an agent first, then across agents.
- **Conflict strategies** — `recency` (default) or `authority` (seeded per entity) — instead of silent overwrite.
- **Disputes table** records what conflicted and how, when authority cannot pick a winner.

Vector search uses **FAISS** by default (`faiss-node`), with claim rows in SQL as the source of truth — a local vector index plus relational storage, not a hosted vector database. Multi-agent conflict resolution is the differentiator.

---

## Monorepo layout

```
vault/
├── packages/
│   └── vault-memory/     # npm package — Memory API, schema, vector store, conflict resolution
├── apps/
│   ├── cli-agent/        # Multi-agent CLI demo (two terminals, one SQLite file)
└── └── web/              # Marketing / docs site (Next.js)
```

| Package / app | Purpose |
|---------------|---------|
| [`packages/vault-memory`](./packages/vault-memory) | Core library: `Memory`, schema, FAISS search, classify, resolve |
| [`apps/cli-agent`](./apps/cli-agent) | Runnable demo: `agent-a` + `agent-b` on `vault-shared.db` |
| [`apps/web`](./apps/web) | Landing page and product UI |

---

## Quickstart (npm consumer)

Install the package and a Drizzle driver:

```bash
npm install vault-memory drizzle-orm better-sqlite3
```

`faiss-node` is installed automatically for vector search. Create tables (or use Drizzle migrations from `vault-memory/schema`), then:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Memory } from "vault-memory";

const sqlite = new Database("vault.db");
// ... create claims (+ agent_authority, disputes for multi-agent) tables — see packages/vault-memory/README.md

const db = drizzle(sqlite);
const memory = new Memory("agent-a", {
  db,
  apiKey: process.env.OPENAI_API_KEY,
});

await memory.add(
  [{ role: "user", content: "I'm vegetarian" }],
  "conversation-1",
);

const results = await memory.search("what does the user eat?");
```

Full API, schema, and migration notes: **[packages/vault-memory/README.md](./packages/vault-memory/README.md)**.

---

## Quickstart (monorepo development)

**Requirements:** [Bun](https://bun.sh) 1.2+

```bash
git clone https://github.com/theMillenniumFalcon/vault.git
cd vault
bun install
```

If Bun blocks the `faiss-node` native postinstall:

```bash
bun pm trust faiss-node
bun install
```

### Build and test the library

```bash
cd packages/vault-memory
bun run build
bun test
bun run typecheck
```

### Run the multi-agent CLI demo

```bash
cd apps/cli-agent
cp .env.example .env
# Set OPENAI_API_KEY in .env

# Terminal 1
bun run start:agent-a

# Terminal 2
bun run start:agent-b
```

Try a timezone conflict: agent-a says "I'm in PST", agent-b says "I'm in EST". Then `/search what timezone is the user in?` — agent-a wins on authority. Details: **[apps/cli-agent/README.md](./apps/cli-agent/README.md)**.

### Run the marketing site

```bash
cd apps/web
bun run dev
```

---

## How it works

### Pipeline (`Memory.add`)

```
messages
  → extractFacts (LLM, latest turn only)
  → embed
  → classifyAgainstOwnHistory (vector search + LLM → ADD | UPDATE | REPLACE | NOOP)
  → if ADD: classifyAgainstOtherAgents (entity-scoped cross-agent search + strategy)
  → apply op (write claim row + sync FAISS index)
```

### Vector search

| Layer | Technology |
|-------|------------|
| **Canonical storage** | SQLite or Postgres via Drizzle — embeddings in `claims.embedding` (JSON) |
| **Search index (default)** | `FaissVectorStore` — FAISS `IndexFlatIP`, exact native inner-product search |
| **Legacy opt-out** | `MemoryVectorStore` — in-process JS brute-force cosine |
| **Postgres path** | `PgVectorStore` (`vault-memory/pg`) — shared DB + `pgvector` |

Search applies **recency decay** at query time (`recencyWeightedScore`) and bumps `lastAccessedAt` on returned claims — stored `confidence` is not mutated.

### Multi-agent conflict

| Strategy | Behavior |
|----------|----------|
| **`recency`** (default) | Newest claim supersedes all conflicting active claims from other agents |
| **`authority`** | Incoming agent must beat every conflicting agent's weight on that entity; else **DISPUTE** |

Authority weights live in `agent_authority` and must be seeded (`seedAuthority` / `EXAMPLE_AUTHORITY_SEED`). Open disputes are auditable in the `disputes` table.

Deep dive: **[packages/vault-memory/docs/multi-agent-conflict.md](./packages/vault-memory/docs/multi-agent-conflict.md)**.

---

## Configuration (`MemoryConfig`)

```typescript
interface MemoryConfig {
  db: VaultDb;
  apiKey?: string;              // builds default OpenAI embed + LLM if set
  embed?: EmbedFn;
  llm?: LLMFn;
  model?: string;
  embeddingModel?: string;
  vectorStore?: VectorStore;    // default: FaissVectorStore
  vectorDimensions?: number;    // default: 1536 (text-embedding-3-small)
  entityStrategies?: Partial<Record<string, "recency" | "authority">>;
}
```

Multi-agent example with authority on timezones:

```typescript
import { Memory, seedAuthority } from "vault-memory";

await seedAuthority(db, [
  { entity: "user.timezone", agentId: "agent-a", weight: 0.9 },
  { entity: "user.timezone", agentId: "agent-b", weight: 0.2 },
]);

const memory = new Memory("agent-b", {
  db,
  apiKey: process.env.OPENAI_API_KEY,
  entityStrategies: { "user.timezone": "authority" },
});
```

---

## Schema

Phase 1 table:

- **`claims`** — facts with `sourceAgent`, `entity`, `text`, `type`, `status` (`active` | `superseded` | `disputed`), `embedding`, timestamps

Phase 2 additions:

- **`agent_authority`** — per-agent trust weights per entity (supports wildcards like `user.schedule.*`)
- **`disputes`** — audit trail when authority cannot resolve a conflict

Import for migrations:

```typescript
import { claims, agentAuthority, disputes } from "vault-memory/schema";
```

---

## Scripts (root)

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace dependencies |
| `cd packages/vault-memory && bun test` | Run library tests (63 cases) |
| `cd packages/vault-memory && bun run verify:consumer` | Pack tarball and smoke-test outside monorepo |
| `cd apps/cli-agent && bun test` | Multi-agent wiring tests |
| `bun run changeset` | Add a changeset (release workflow) |

---

## Architecture diagram
```
┌─────────────────────────────────────────────────────────────┐
│  Agent process (agent-a, agent-b, …)                        │
│  ┌─────────────┐    ┌──────────────────┐                    │
│  │   Memory    │--->│ FaissVectorStore │  (per-process)     │
│  └──────┬──────┘    └────────┬─────────┘                    │
│         │ extract/classify   │ rebuild / upsert             │
└─────────┼────────────────────┼──────────────────────────────┘
          │                    │
          ▼                    ▼
   ┌──────────────────────────────────────┐
   │  Shared DB (SQLite file or Postgres) │
   │  claims · agent_authority · disputes │
   └──────────────────────────────────────┘
```

Each agent process holds its own FAISS index in memory. When using a shared SQLite file (CLI demo), call `vectorStore.rebuild(db)` before reads/writes so the index sees other agents' claims — see `syncVectorIndex` in `apps/cli-agent`.

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [docs/README.md](./docs/README.md) | **Internal docs index** — start here for team onboarding |
| [packages/vault-memory/README.md](./packages/vault-memory/README.md) | Install, quickstart, API, config (npm) |
| [packages/vault-memory/docs/multi-agent-conflict.md](./packages/vault-memory/docs/multi-agent-conflict.md) | Two-pass classify, strategies, disputes (package copy) |
| [apps/cli-agent/README.md](./apps/cli-agent/README.md) | Two-terminal multi-agent demo |
| [MANUAL-TESTING.md](./MANUAL-TESTING.md) | E2E testing guide (PowerShell) |

---

## Roadmap / status

| Area | Status |
|------|--------|
| Extract → classify → store (ADD/UPDATE/REPLACE/NOOP) | Shipped |
| FAISS vector search (default) | Shipped |
| Search-time recency decay | Shipped |
| Multi-agent two-pass classify | Shipped |
| `recency` + `authority` strategies | Shipped |
| Synthetic conflict test harness | Shipped |
| CLI multi-agent demo | Shipped |
| `listOpenDisputes` + `resolveDispute` | Shipped |
| `vault-memory@0.2.0` npm publish + consumer two-agent test | Shipped on npm |
| Approximate FAISS indexes (IVF/HNSW) | Not needed until 10k+ claims |

---

## Contributing

1. Fork and clone the repo.
2. `bun install` at the root.
3. Make changes in `packages/vault-memory` or `apps/*`.
4. Run tests: `bun test` in the package you touched.
5. Open a PR with a clear description of behavior changes (especially conflict policy).

Use [Changesets](https://github.com/changesets/changesets) for `vault-memory` version bumps before release.

---

## License

MIT — see [packages/vault-memory/LICENSE](./packages/vault-memory/LICENSE).
