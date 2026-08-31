# Team onboarding — how Vault works

Pointwise walkthrough for explaining Vault to someone new on the team. Start here, then drill into linked docs for depth.

---

## What problem we're solving

1. **AI agents need memory** — they should remember facts from conversations ("user is vegetarian", "user is in PST") and retrieve them later via semantic search.

2. **Most memory libs assume one writer** — if two agents share a store, the last write silently wins. That's bad when a scheduling agent and a chat agent both learn different things about the same user.

3. **Vault's pitch** — every fact is a **claim** tagged with which agent wrote it (`sourceAgent`). When agents disagree, we **detect, resolve, or dispute** instead of blindly overwriting.

4. **The npm package is `vault-memory@0.2.0+`**. The repo is a monorepo around that library plus demo apps.

---

## Repo layout (what lives where)

5. **`packages/vault-memory/`** — the real product. This is what ships to npm. Everything else is demo, docs, or internal tooling.

6. **`apps/cli-agent/`** — a hands-on demo: run `agent-a` and `agent-b` in two terminals, both writing to the same SQLite file. Best way to *see* conflict resolution work.

7. **`apps/web/`** — marketing/landing site (Next.js). Not core to the memory engine.

8. **`docs/`** — internal team documentation (this folder).

9. **`plan1.md` / `plan2.md`** — internal design notes. Phase 1 = single-agent foundation. Phase 2 = multi-agent + FAISS vector store.

10. **`packages/vault-memory/docs/`** — package-level deep-dive (e.g. conflict resolution). Not shipped in the npm tarball.

---

## Core mental model: claims, not key-value pairs

11. **A claim is one fact** — e.g. `{ entity: "user.timezone", text: "The user is in PST", sourceAgent: "agent-a" }`.

12. **Entities are structured keys** — like `user.timezone`, `user.mood`, `user.diet`. They group related facts and drive conflict rules. See [entities.md](./entities.md) for how they're chosen.

13. **Claims have a lifecycle status**:
    - `active` — current truth
    - `superseded` — replaced by a newer claim
    - `disputed` — two agents disagree and authority couldn't pick a winner

14. **Claims link to history** — `supersedes` points at the old claim ID. The `disputes` table records *what conflicted with what* for debugging ("why does memory say X?").

15. **Each agent gets its own `Memory` instance** — you pass an `agentId` string (`"agent-a"`, `"agent-b"`). That ID is stamped on every claim that agent writes.

---

## Database: you bring it, we bring the logic

16. **Vault does not ship a database** — you wire up Drizzle + SQLite (`better-sqlite3`) or Postgres yourself.

17. **Three tables matter**:
    - `claims` — all facts + embeddings (JSON) + metadata
    - `agent_authority` — per-agent trust weights per entity (for conflict resolution)
    - `disputes` — audit trail of unresolved conflicts

18. **Schema is exported** from `vault-memory/schema` so consumers can run Drizzle migrations. Details: [schema.md](./schema.md).

19. **SQL is the source of truth** — embeddings live in `claims.embedding`. The vector index is just an index; if it drifts, you rebuild from the DB.

---

## The main API: `Memory`

20. **Constructor** — `new Memory("agent-a", { db, apiKey, ... })`. The agent ID is fixed for that instance.

21. **Four public methods**:
    - `add(messages, conversationId)` — ingest a conversation turn
    - `search(query)` — semantic search (scoped to *this* agent by default)
    - `update(claimId, text)` — edit a claim you own
    - `delete(claimId)` — remove a claim you own

22. **Config is pluggable** — you can swap the embed model, LLM, vector store, and per-entity conflict strategy. Defaults use OpenAI for extract/classify/embed if you pass `apiKey`. Full reference: [api.md](./api.md).

---

## What happens on `memory.add()` (the pipeline)

23. **Step 1 — Extract** — an LLM reads the latest conversation turn and pulls out structured facts (`entity`, `text`, `type`).

24. **Step 2 — Embed** — each fact's text is turned into a vector (default: OpenAI `text-embedding-3-small`, 1536 dims).

25. **Step 3 — Classify against own history** (Phase 1 logic):
    - Search this agent's existing claims for similar facts
    - LLM decides: `ADD` (new), `UPDATE` (tweak wording), `REPLACE` (contradicts own old claim), or `NOOP` (already known)

26. **Step 4 — Classify against other agents** (only if step 3 returned `ADD`):
    - Search *other agents'* active claims on the **same entity**
    - If no conflict → store as `ADD`
    - If conflict → run a resolution strategy (see below)

27. **Step 5 — Apply** — write the claim row to SQL and sync the vector index (upsert or remove).

Full diagram: [architecture.md](./architecture.md).

---

## Vector search (how retrieval works)

28. **Default backend is FAISS** (`faiss-node`) — a native C++ index for fast similarity search. Each agent process holds its own in-memory FAISS index.

29. **Alternatives**:
    - `MemoryVectorStore` — pure JS brute-force cosine. No native deps. Good for tests/CI.
    - `PgVectorStore` (`vault-memory/pg`) — Postgres + pgvector. Best when multiple processes share one DB and you don't want per-process rebuilds.

30. **Search flow** — embed the query → vector store returns top-k claim IDs + scores → hydrate full claim rows from SQL → apply **recency decay** (older/unused facts score lower) → bump `lastAccessedAt` on returned claims.

31. **Important multi-process gotcha** — if two agents share a SQLite file, each has its own FAISS index. Before reads/writes, you must call `vectorStore.rebuild(db)` so the local index sees the other agent's writes. The CLI demo does this automatically via `syncVectorIndex()`. Details: [vector-store.md](./vector-store.md).

---

## Multi-agent conflict resolution (the differentiator)

32. **Two strategies ship today**:
    - **`recency`** (default) — newest claim wins, older ones get `superseded`
    - **`authority`** — compare agent weights from `agent_authority`; higher weight wins; if incoming agent can't beat *all* conflicting agents → `DISPUTE`

33. **Authority must be seeded** — without rows in `agent_authority`, everything silently falls back to recency. Use `seedAuthority(db, [...])` or `EXAMPLE_AUTHORITY_SEED`.

34. **Per-entity strategy** — set `entityStrategies: { "user.timezone": "authority" }` on the `Memory` config. Unconfigured entities default to recency.

35. **Classic demo scenario**:
    - agent-a (scheduling, weight 0.9 on `user.timezone`) hears "I'm in PST"
    - agent-b (chat, weight 0.2) hears "I'm in EST"
    - agent-b's claim is stored as `disputed`
    - search returns agent-a's PST claim as the active truth

36. **Dispute resolution** — when authority ties, claims are parked as `disputed`. Poll `listOpenDisputes(db)` and call `resolveDispute(db, vectorStore, disputeId, winningClaimId)` from your app (human, policy, or your own LLM).

Deep dive: [multi-agent-conflict.md](./multi-agent-conflict.md).

---

## How the CLI demo wires it together

37. **Two terminals, one DB file** (`vault-shared.db`).

38. **`bootstrapSharedStore()`** — creates tables + seeds authority weights on first run.

39. **`createAgentMemory(agentId, db)`** — builds a `Memory` instance with FAISS per process.

40. **`syncVectorIndex()`** — rebuilds FAISS from DB before every operation (the multi-process workaround).

41. **`searchSharedStore()`** — searches across *all* agents (no `sourceAgent` filter), so you can ask "what timezone is the user in?" and get the winning claim regardless of which terminal you're on.

42. **Slash commands** — `/search`, `/claims`, `/disputes` let you inspect state without reading SQL.

Walkthrough: [cli-demo.md](./cli-demo.md).

---

## Testing strategy

43. **Unit/integration tests** — `packages/vault-memory/test/`, run with `bun test`. Includes a synthetic multi-agent conflict harness with deterministic fake embeddings (no API calls).

44. **Consumer verification** — `bun run verify:consumer` packs the tarball, installs it in a scratch npm project, and runs single-agent + two-agent conflict scripts. Confirms the *published package* works outside the monorepo.

45. **CLI agent tests** — `apps/cli-agent` has wiring tests for shared-store bootstrap and index sync.

Full checklist: [manual-testing.md](./manual-testing.md).

---

## Release workflow

46. **Changesets** — breaking schema changes get a changeset file; `bun run version-packages` bumps version + generates CHANGELOG.

47. **Build** — `tsup` bundles `packages/vault-memory` to `dist/` with entry points: main, `schema`, `pg`, `faiss`.

48. **Publish** — `vault-memory@0.2.0` is live on npm. Consumers upgrade, run Drizzle migrations for the two new tables, seed authority if they want multi-agent behavior.

Details: [publishing.md](./publishing.md).

---

## The one diagram to remember

```
Agent process (agent-a)
  Memory  →  FaissVectorStore (in-memory, per-process)
     ↓              ↓ upsert/rebuild
  Shared DB (SQLite file or Postgres)
    claims · agent_authority · disputes
```

Multiple agent processes → multiple FAISS indexes → one shared DB. SQL is canonical; FAISS is a cache you rebuild when needed.

---

## Where to go next

49. **Read** [getting-started.md](./getting-started.md) for install commands and first run.

50. **Run** the CLI demo (`apps/cli-agent`) with two terminals and try the PST/EST conflict.

51. **Trace** `Memory.add()` in `packages/vault-memory/src/memory.ts` — that's the spine of the whole system.

52. **Skim** [plan2.md](../plan2.md) for design rationale and what's intentionally *not* built yet.

---

## Doc map (quick links)

| Topic | Doc |
|-------|-----|
| Pipeline & examples | [pipeline.md](./pipeline.md) |
| Install & first run | [getting-started.md](./getting-started.md) |
| Pipeline & components | [architecture.md](./architecture.md) |
| Entity strings | [entities.md](./entities.md) |
| Conflict policy | [multi-agent-conflict.md](./multi-agent-conflict.md) |
| FAISS / rebuild | [vector-store.md](./vector-store.md) |
| Tables & migrations | [schema.md](./schema.md) |
| API surface | [api.md](./api.md) |
| CLI walkthrough | [cli-demo.md](./cli-demo.md) |
| E2E testing | [manual-testing.md](./manual-testing.md) |
| npm release | [publishing.md](./publishing.md) |
