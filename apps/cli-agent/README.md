# CLI agent — multi-agent integration demo

Two (or more) independent agent processes share one SQLite database. Each process constructs its own `Memory` instance with a hardcoded `agentId`, matching the Phase 2 wiring model.

## Setup

```bash
cd apps/cli-agent
bun install
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
```

Bun loads `.env` automatically from this directory. You can also pass a file explicitly:

```bash
bun --env-file=.env run start:agent-a
```

## Run two agents on one store

**Terminal 1 — scheduling agent (agent-a, higher timezone authority):**

```bash
bun run start:agent-a
```

**Terminal 2 — chat agent (agent-b):**

```bash
bun run start:agent-b
```

Both default to `vault-shared.db` in this directory. Override with `VAULT_DB_PATH` if needed.

## Try a cross-agent conflict

In terminal 1 (agent-a):

```
You: I'm in PST
```

In terminal 2 (agent-b):

```
You: I'm in EST
```

Agent-b's claim is stored as `disputed` because agent-a has higher authority on `user.timezone`. The terminal that stored it then asks which statement to keep:

```
user.timezone conflict
  1. agent-a (in use): "The user is in PST"
  2. agent-b (saved, not used): "The user is in EST"
Pick 1 or 2, or press Enter to leave it open:
```

Choosing `1` keeps PST in search and files EST as old. Choosing `2` switches search over to EST. Pressing Enter leaves the dispute open. Either terminal can review open disputes later with `/resolve`.

Search from either terminal still returns the claim that is in use:

```
You: /search what timezone is the user in?
```

Inspect all rows:

```
You: /claims
You: /disputes
You: /resolve
```

## How it works

| Piece | Role |
|-------|------|
| `createDb(path)` | Shared SQLite file with `claims`, `agent_authority`, `disputes` |
| `bootstrapSharedStore(db)` | Seeds `EXAMPLE_AUTHORITY_SEED` once on first use |
| `createAgentMemory(agentId, db, config)` | One `Memory` + FAISS `FaissVectorStore` per process |
| `syncVectorIndex()` | Rebuilds the local vector index from DB before each read/write (required because each process has its own in-memory index) |
| `searchSharedStore()` | Search across all agents (no `sourceAgent` filter) |

Authority defaults (`user.timezone`, `user.mood` → `authority` strategy) live in `src/memory-setup.ts`.

## Generic entry point

`bun run start` uses `AGENT_ID` (default `agent-a`) and `VAULT_DB_PATH` (default `vault.db`). Set both in `.env` or the shell:

```bash
AGENT_ID=agent-b VAULT_DB_PATH=./vault-shared.db bun run start
```

## Postgres (production path)

When SQLite single-writer becomes a bottleneck, point all agents at the same Postgres database and use `PgVectorStore` from `vault-memory/pg` so the shared DB is also the vector index. See `packages/vault-memory/README.md` for vector-store options.
