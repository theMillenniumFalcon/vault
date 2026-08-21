# Getting started

Onboarding guide for developers joining the Vault project.

## What Vault is

Vault is **agent-attributed memory** for AI agents:

- Extract facts from conversation (LLM)
- Store them as **claims** with semantic search (FAISS by default)
- Detect contradictions within and across agents
- Resolve conflicts with policy (`recency` or `authority`) instead of silent last-write-wins

The shippable product is **`vault-memory`** on npm (`0.2.0+`). The monorepo wraps that library with demos and internal docs.

## Why it exists

Most agent memory libraries assume **one writer**. Vault targets **multiple independent agents** (scheduling, chat, tools) sharing one store:

- Every fact records which agent wrote it (`sourceAgent`)
- Cross-agent conflicts produce **superseded**, **disputed**, or **audit** rows — not silent overwrite
- Authority weights let domain-specific agents win (e.g. scheduling agent owns `user.timezone`)

## Monorepo layout

```
vault/
├── packages/vault-memory/   # npm package — the core library
├── apps/cli-agent/          # Multi-agent CLI demo (two terminals, one SQLite file)
├── apps/web/                # Marketing site (Next.js) — does not exercise memory
├── docs/                    # Internal documentation (this folder)
├── plan1.md                 # Phase 1 design notes
└── plan2.md                 # Phase 2 design notes
```

| Path | Purpose |
|------|---------|
| `packages/vault-memory` | `Memory` API, schema, classify, resolve, vector store |
| `apps/cli-agent` | Runnable demo: `agent-a` + `agent-b` on `vault-shared.db` |
| `apps/web` | Landing page |

## Requirements

- [Bun](https://bun.sh) 1.2+ for monorepo development
- OpenAI API key for CLI demo (real LLM extraction)
- `better-sqlite3` or Postgres for database (you bring the driver)

## Install

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

## Build and test the library

```bash
cd packages/vault-memory
bun run build
bun test
bun run typecheck
bun run verify:consumer   # packs tarball, tests outside monorepo
```

## Run the multi-agent CLI demo

```bash
cd apps/cli-agent
cp .env.example .env
# Set OPENAI_API_KEY in .env

# Terminal 1
bun run start:agent-a

# Terminal 2
bun run start:agent-b
```

Try the timezone conflict: agent-a says "I'm in PST", agent-b says "I'm in EST". Then `/search what timezone is the user in?` — agent-a wins on authority.

Full walkthrough: [CLI demo](./cli-demo.md).

## npm consumer quickstart

```bash
npm install vault-memory drizzle-orm better-sqlite3
```

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Memory } from "vault-memory";

const sqlite = new Database("vault.db");
// Create tables or run Drizzle migrations — see schema.md

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

Public-facing API docs: [packages/vault-memory/README.md](../packages/vault-memory/README.md).

## Where to read next

1. [Architecture](./architecture.md) — trace one `memory.add()` call
2. [Entities](./entities.md) — how `user.timezone` etc. are decided
3. [Multi-agent conflict](./multi-agent-conflict.md) — the differentiator
4. [Manual testing](./manual-testing.md) — verify everything works

## Mental model (one diagram)

```
Agent process (agent-a)
  Memory  →  FaissVectorStore (in-memory, per-process)
     ↓              ↓ upsert / rebuild
  Shared DB (SQLite file or Postgres)
    claims · agent_authority · disputes
```

Multiple agent processes → multiple FAISS indexes → one shared DB. SQL is canonical; FAISS is a cache you rebuild when needed.
