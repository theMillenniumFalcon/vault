# Vault — Manual End-to-End Testing Guide

How to verify every feature is working as intended, from automated regression to full multi-agent CLI flows.

## What you're testing

Vault is really two things:

| Layer | What it is | How you exercise it |
|-------|------------|---------------------|
| **`vault-memory`** | Core library (extract → classify → store → search → conflict resolution) | `bun test`, `verify:consumer` |
| **`apps/cli-agent`** | Two real agent processes sharing one SQLite DB + FAISS | Two terminals + OpenAI API |

`apps/web` is a marketing site only — it does not exercise memory features.

---

## 0. One-time setup

```powershell
cd d:\vault
bun install
```

If Bun blocks `faiss-node`:

```powershell
bun pm trust faiss-node
bun install
```

CLI demo needs an API key:

```powershell
cd d:\vault\apps\cli-agent
copy .env.example .env
# Edit .env — set OPENAI_API_KEY
```

For a clean manual run, delete the old DB first:

```powershell
Remove-Item d:\vault\apps\cli-agent\vault-shared.db -ErrorAction SilentlyContinue
```

---

## 1. Automated regression (~5 min) — run this first

These cover most logic without OpenAI.

```powershell
# Library — ~63 tests: classify, resolve, FAISS, multi-agent conflicts, decay, etc.
cd d:\vault\packages\vault-memory
bun run build
bun test
bun run typecheck

# CLI wiring — multi-agent smoke tests (mocked LLM, no API key)
cd d:\vault\apps\cli-agent
bun test
bun run typecheck

# Published package — packs tarball, installs in temp dir, runs two-agent conflict
cd d:\vault\packages\vault-memory
bun run verify:consumer
```

### What this validates

- Single-agent ops: ADD / UPDATE / REPLACE / NOOP
- FAISS index sync + `rebuild`
- Two-pass classification (own history → cross-agent)
- `recency` and `authority` strategies
- `DISPUTE` + `disputes` table
- Search-time decay (unit tests)
- Published `vault-memory@0.2.0` tarball works outside the monorepo

If all of this passes, the core engine is healthy. Manual testing below confirms **real LLM extraction + real FAISS + two terminal processes**.

---

## 2. Manual E2E — two-agent CLI (~20–30 min)

This is the main "does the whole product work?" test. You need **two terminals** and a valid `OPENAI_API_KEY`.

**Terminal 1**

```powershell
cd d:\vault\apps\cli-agent
bun run start:agent-a
```

**Terminal 2**

```powershell
cd d:\vault\apps\cli-agent
bun run start:agent-b
```

CLI commands: `/search <query>`, `/claims`, `/disputes`, `/quit`

---

### Test A — Basic memory (single agent, extraction + search)

**Terminal 1 only**

```
You: I'm vegetarian and I don't eat meat
```

Expected:

- `Stored:` line with at least one claim (`user.diet` or similar)
- Status `[active]`

```
You: /search what does the user eat?
```

Expected:

- Result mentioning vegetarian / no meat
- `sourceAgent` = `agent-a`
- Score shown (e.g. `[0.842]`)

**Validates:** fact extraction, embedding, FAISS search, claim persistence.

---

### Test B — Same-agent correction (UPDATE / REPLACE / NOOP)

Still in **terminal 1**:

```
You: Actually I'm vegan now, not just vegetarian
```

Expected:

- New stored claim OR update to existing diet claim (LLM-dependent)
- `/claims` should show old claim `superseded` or updated text — not two conflicting active diet claims from the same agent

Then repeat the same fact:

```
You: I'm vegan
```

Expected:

- `(no new memories)` or NOOP — no duplicate active claims

**Validates:** Phase 1 classify pass (own history), not cross-agent yet.

---

### Test C — Authority conflict (the headline feature)

**Terminal 1 (agent-a — scheduling agent, higher timezone authority)**

```
You: I'm in PST, Pacific time
```

**Terminal 2 (agent-b — chat agent, lower timezone authority)**

```
You: I'm in EST, Eastern time
```

Expected in terminal 2:

- Stored claim with status **`[disputed]`** (not `active`)

Both terminals:

```
You: /disputes
```

Expected:

- One open dispute on `user.timezone`
- Strategy `authority`
- agent-b's EST claim vs agent-a's PST claim

```
You: /search what timezone is the user in?
```

Expected (either terminal):

- Top result from **`agent-a`**
- Text contains **PST** / Pacific
- agent-b's EST claim is `disputed`, not returned as active winner

**Validates:** cross-agent classify, `seedAuthority`, authority strategy, disputes audit, FAISS rebuild across processes (`syncVectorIndex` runs before each op).

---

### Test D — Recency fallback (no authority on entity)

Authority is only seeded for `user.timezone` and `user.mood`. Diet has **no** authority weights → defaults to **recency**.

**Terminal 1**

```
You: I love Italian food
```

**Terminal 2**

```
You: I hate Italian food, I only eat Japanese
```

Expected:

- agent-b's claim is **`active`**
- agent-a's claim is **`superseded`** (not disputed)
- `/disputes` stays empty
- `/search what food does the user like?` → agent-b's newer claim wins

**Validates:** recency strategy when no authority config exists.

---

### Test E — Mood authority (agent-b should win)

From `EXAMPLE_AUTHORITY_SEED`: agent-b has weight 0.8 on `user.mood`, agent-a has 0.3.

**Terminal 2 first**

```
You: I'm feeling really happy today
```

**Terminal 1**

```
You: The user seems sad and down
```

Expected:

- agent-a's mood claim → **`disputed`**
- `/search how is the user feeling?` → agent-b's happy claim wins

**Validates:** authority works on a second entity, not just timezone.

---

### Test F — Cross-process index sync

After Test C, **restart terminal 2** (quit and `bun run start:agent-b` again) without deleting the DB.

```
You: /search what timezone is the user in?
```

Expected:

- Still returns agent-a PST (proves `rebuild` on startup path works)

**Validates:** per-process FAISS index + shared SQLite file.

---

## 3. Verify published npm package (optional but recommended)

Confirm the **registry** build, not just workspace source:

```powershell
cd d:\vault\packages\vault-memory
bun run verify:consumer
```

Or manually in a scratch folder:

```powershell
mkdir $env:TEMP\vault-scratch
cd $env:TEMP\vault-scratch
npm init -y
npm install vault-memory@0.2.0 better-sqlite3 drizzle-orm
```

Then run the scripts from `packages/vault-memory/scripts/verify-consumer.mjs` logic (single-agent + two-agent on shared SQLite).

---

## 4. Feature coverage checklist

| Feature | Best way to verify |
|---------|-------------------|
| Fact extraction (LLM) | CLI Test A |
| Embeddings + FAISS search | CLI `/search` scores |
| Single-agent ADD/UPDATE/REPLACE/NOOP | CLI Test B + `bun test` in vault-memory |
| `memory.search` scoped to one agent | **Unit tests only** — CLI uses cross-agent `searchSharedStore` |
| `memory.update` / `memory.delete` | **Unit tests only** — not exposed in CLI |
| FAISS default backend | CLI runs (real native FAISS) |
| `vectorStore.rebuild()` | CLI Test F (restart agent) |
| Two-pass classification | CLI Test C |
| `recency` strategy | CLI Test D |
| `authority` strategy | CLI Test C, E |
| `DISPUTE` status + `disputes` table | CLI `/disputes` after Test C |
| `seedAuthority` / `agent_authority` | Auto-seeded on first CLI start; Test C/E behavior proves it |
| Search-time decay | `packages/vault-memory/test/search.test.ts` (hard to see manually) |
| `MemoryVectorStore` opt-out | `verify:consumer` (uses it in scratch npm install) |
| `PgVectorStore` | Not in CLI demo — needs Postgres + `vault-memory/pg` |
| `listOpenDisputes` / `resolveDispute` | `packages/vault-memory/test/disputes.test.ts` |

---

## 5. What the CLI does not test

To fully cover the API surface, you'd need a small script (or REPL) for:

- `memory.update(claimId, text)` — re-embed + vector upsert
- `memory.delete(claimId)` — row + vector removal
- Per-agent `memory.search()` vs cross-agent `search()` — CLI only does cross-agent

Those are covered by automated tests in `packages/vault-memory/test/memory.test.ts`.

---

## 6. Quick "all green" command sequence

```powershell
cd d:\vault
bun install

cd packages\vault-memory
bun run build
bun test
bun run verify:consumer

cd ..\..\apps\cli-agent
bun test

# Then manual: two terminals, Tests A–F above
```

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `faiss.IndexFlatIP is not a constructor` | `faiss-node` native binding failed — run `bun pm trust faiss-node` and reinstall |
| Second agent doesn't see first agent's claims | Forgot `syncVectorIndex` — should be automatic in CLI; restart agent or check same `VAULT_DB_PATH` |
| No dispute on timezone conflict | Stale DB from old run — delete `vault-shared.db` and retry |
| `(no new memories)` on everything | LLM returned NOOP — rephrase more clearly as a factual statement |
| High OpenAI cost | Each message = extract + embed + classify LLM calls |

---

## Summary

1. Run the automated suite first (`bun test` + `verify:consumer`).
2. Do the two-terminal CLI walkthrough (Tests A–F) with a fresh `vault-shared.db`.

That covers every user-facing feature except Postgres and the `update`/`delete` APIs.
