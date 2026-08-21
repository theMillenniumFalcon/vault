# Manual testing

How to verify every feature works — automated regression first, then two-terminal CLI.

## What you're testing

| Layer | What it is | How you exercise it |
|-------|------------|---------------------|
| **`vault-memory`** | Core library | `bun test`, `verify:consumer` |
| **`apps/cli-agent`** | Two real agent processes + shared SQLite + FAISS | Two terminals + OpenAI API |

`apps/web` is marketing only — does not exercise memory.

---

## 0. One-time setup

```bash
cd vault
bun install
```

If Bun blocks `faiss-node`:

```bash
bun pm trust faiss-node
bun install
```

CLI demo:

```bash
cd apps/cli-agent
cp .env.example .env
# Set OPENAI_API_KEY
```

Clean manual run — delete old DB:

```bash
rm apps/cli-agent/vault-shared.db
```

---

## 1. Automated regression (~5 min)

Run this first.

```bash
# Library — classify, resolve, FAISS, multi-agent conflicts, decay
cd packages/vault-memory
bun run build
bun test
bun run typecheck

# CLI wiring — mocked LLM, no API key
cd ../../apps/cli-agent
bun test
bun run typecheck

# Published package — tarball + two-agent conflict in scratch dir
cd ../../packages/vault-memory
bun run verify:consumer
```

### What this validates

- Single-agent: ADD / UPDATE / REPLACE / NOOP
- FAISS index sync + `rebuild`
- Two-pass classification
- `recency` and `authority` strategies
- `DISPUTE` + `disputes` table
- Search-time decay (unit tests)
- `vault-memory@0.2.0` tarball works outside monorepo

---

## 2. Manual E2E — two-agent CLI (~20–30 min)

**Terminal 1:** `cd apps/cli-agent && bun run start:agent-a`
**Terminal 2:** `cd apps/cli-agent && bun run start:agent-b`

Commands: `/search <query>`, `/claims`, `/disputes`, `/quit`

### Test A — Basic memory

Terminal 1:

```
You: I'm vegetarian and I don't eat meat
You: /search what does the user eat?
```

Expected: stored claim (`user.diet` or similar), search returns vegetarian fact, `sourceAgent` = `agent-a`.

### Test B — Same-agent correction

```
You: Actually I'm vegan now, not just vegetarian
You: I'm vegan
```

Expected: no duplicate active diet claims; second message may NOOP.

### Test C — Authority conflict (headline feature)

Terminal 1: `I'm in PST, Pacific time`
Terminal 2: `I'm in EST, Eastern time`

Expected:

- Terminal 2: stored claim **`[disputed]`**
- `/disputes`: one row on `user.timezone`, strategy `authority`
- `/search what timezone is the user in?` → agent-a, PST

### Test D — Recency fallback

Terminal 1: `I love Italian food`
Terminal 2: `I hate Italian food, I only eat Japanese`

Expected: agent-b active, agent-a superseded, no disputes, search returns agent-b.

### Test E — Mood authority (agent-b wins)

Terminal 2: `I'm feeling really happy today`
Terminal 1: `The user seems sad and down`

Expected: agent-a mood claim disputed, search returns agent-b happy claim.

### Test F — Cross-process index sync

Restart terminal 2 without deleting DB. Run `/search what timezone is the user in?`

Expected: still returns agent-a PST (rebuild on startup works).

---

## 3. Feature coverage checklist

| Feature | Best verification |
|---------|-------------------|
| Fact extraction (LLM) | CLI Test A |
| Embeddings + FAISS search | CLI `/search` scores |
| Single-agent ADD/UPDATE/REPLACE/NOOP | CLI Test B + `bun test` |
| `memory.search` scoped to one agent | Unit tests only |
| `memory.update` / `memory.delete` | Unit tests only |
| FAISS default backend | CLI runs |
| `vectorStore.rebuild()` | CLI Test F |
| Two-pass classification | CLI Test C |
| `recency` strategy | CLI Test D |
| `authority` strategy | CLI Test C, E |
| `DISPUTE` + `disputes` table | CLI `/disputes` |
| `seedAuthority` | Auto on first CLI start |
| Search-time decay | `test/search.test.ts` |
| `MemoryVectorStore` opt-out | `verify:consumer` |
| `PgVectorStore` | Not in CLI — needs Postgres |
| `consensus` / `llm-judge` | Not implemented |

---

## 4. Quick "all green" sequence

```bash
cd vault && bun install
cd packages/vault-memory && bun run build && bun test && bun run verify:consumer
cd ../../apps/cli-agent && bun test
# Then manual: two terminals, Tests A–F
```

---

## 5. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `faiss.IndexFlatIP is not a constructor` | Native binding failed — `bun pm trust faiss-node` |
| Second agent doesn't see first agent's claims | Different `VAULT_DB_PATH` or missing rebuild |
| No dispute on timezone conflict | Stale DB — delete `vault-shared.db` |
| `(no new memories)` on everything | LLM returned NOOP — rephrase as clear fact |
| High OpenAI cost | Each message = extract + embed + classify calls |

---

## Summary

1. Run automated suite (`bun test` + `verify:consumer`)
2. Two-terminal CLI walkthrough (Tests A–F) with fresh `vault-shared.db`

That covers every user-facing feature except Postgres and `update`/`delete` APIs.

Also see root [MANUAL-TESTING.md](../MANUAL-TESTING.md) (PowerShell-oriented copy).
