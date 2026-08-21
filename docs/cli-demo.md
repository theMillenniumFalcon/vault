# CLI demo

Hands-on multi-agent demo using `apps/cli-agent`.

## What it demonstrates

Two independent agent processes (`agent-a`, `agent-b`) share one SQLite file (`vault-shared.db`). Each process has its own FAISS index but reads/writes the same claim rows.

| Piece | File | Role |
|-------|------|------|
| `createDb(path)` | `src/db.ts` | Shared SQLite with all three tables |
| `bootstrapSharedStore(db)` | `src/memory-setup.ts` | Seeds `EXAMPLE_AUTHORITY_SEED` once |
| `createAgentMemory(agentId, db)` | `src/memory-setup.ts` | One `Memory` + FAISS per process |
| `syncVectorIndex()` | `src/memory-setup.ts` | Rebuilds FAISS from DB before each op |
| `searchSharedStore()` | `src/memory-setup.ts` | Cross-agent search (no sourceAgent filter) |

Authority defaults in `SHARED_ENTITY_STRATEGIES`:

```typescript
{
  "user.timezone": "authority",
  "user.mood": "authority",
}
```

## Setup

```bash
cd apps/cli-agent
bun install
cp .env.example .env
# Set OPENAI_API_KEY in .env
```

For a clean run, delete the old DB:

```bash
rm vault-shared.db   # or Remove-Item on Windows
```

## Run

**Terminal 1 — scheduling agent (agent-a):**

```bash
bun run start:agent-a
```

**Terminal 2 — chat agent (agent-b):**

```bash
bun run start:agent-b
```

Both default to `vault-shared.db`. Override with `VAULT_DB_PATH`.

## Commands

| Command | Action |
|---------|--------|
| `<message>` | Extract facts and store |
| `/search <query>` | Cross-agent semantic search |
| `/claims` | List all claim rows |
| `/disputes` | List open disputes |
| `/quit` | Exit |

## Try the timezone conflict

**Terminal 1:**

```
You: I'm in PST
```

**Terminal 2:**

```
You: I'm in EST
```

Expected in terminal 2:

- Stored claim with status **`[disputed]`**

Both terminals:

```
You: /disputes
```

Expected: one open dispute on `user.timezone`, strategy `authority`.

```
You: /search what timezone is the user in?
```

Expected: top result from **agent-a**, text contains **PST**.

## Why agent-a wins

From `EXAMPLE_AUTHORITY_SEED`:

| Entity | agent-a weight | agent-b weight |
|--------|----------------|----------------|
| `user.timezone` | 0.9 | 0.2 |
| `user.mood` | 0.3 | 0.8 |

agent-b cannot beat agent-a on timezone → **DISPUTE** instead of overwrite.

## Generic entry point

```bash
AGENT_ID=agent-b VAULT_DB_PATH=./vault-shared.db bun run start
```

## Recency fallback demo

Entities without authority config (e.g. `user.diet`) use **recency** — newest claim wins, no dispute row.

Terminal 1: `I love Italian food`
Terminal 2: `I hate Italian food, I only eat Japanese`

→ agent-b's claim is active, agent-a superseded, `/disputes` empty.

## Postgres path

When SQLite single-writer becomes a bottleneck, point all agents at Postgres and use `PgVectorStore` from `vault-memory/pg`. See [Vector store](./vector-store.md).

## Full test walkthrough

Structured E2E tests A–F: [Manual testing](./manual-testing.md).

## Related

- [apps/cli-agent/README.md](../apps/cli-agent/README.md) — short quick reference
- [Multi-agent conflict](./multi-agent-conflict.md) — policy details
