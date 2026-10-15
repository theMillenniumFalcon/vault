# How Vault works

Vault is a shared memory layer for AI agents. Several agents can write facts into one database. Each fact is a claim attributed to the agent that wrote it, and when two agents disagree, Vault either supersedes the old claim or records a dispute instead of silently overwriting.

The runnable pieces, ignoring `apps/web`, are the library `packages/vault-memory` and the demo `apps/cli-agent`.

## What lives where

- **`packages/vault-memory`** is the npm library (`vault-memory@0.2.0`). You bring a Drizzle database (SQLite or Postgres) and an OpenAI API key. Vault extracts facts, embeds them, classifies them against existing memory, and writes claim rows.
- **`apps/cli-agent`** is a two-process demo. `agent-a` and `agent-b` are separate terminals that share one SQLite file (`vault-shared.db`). Each process has its own `Memory` instance and its own in-memory FAISS index.

```mermaid
flowchart TB
  subgraph procA [Agent process agent-a]
    MA[Memory]
    FA[FaissVectorStore in memory]
    MA --> FA
  end
  subgraph procB [Agent process agent-b]
    MB[Memory]
    FB[FaissVectorStore in memory]
    MB --> FB
  end
  DB[(Shared SQLite or Postgres<br/>claims · agent_authority · disputes · entities)]
  MA --> DB
  MB --> DB
  FA -. rebuild from SQL .-> DB
  FB -. rebuild from SQL .-> DB
  LLM[OpenAI chat + embeddings]
  MA --> LLM
  MB --> LLM
```

SQL is the source of truth. The vector index is a cache of active claims. If another process wrote claims, this process must rebuild the index before it reads or writes. The CLI does that with `syncVectorIndex()` before every command.

## The data model

A **claim** is one stored fact.

| Field | Role |
|---|---|
| `entity` | Subject key, such as `user.timezone` or `user.diet`. The extractor invents these dotted paths. |
| `text` | Standalone fact, such as "The user is in PST". |
| `type` | `semantic` (stable preference or trait) or `episodic` (a specific event). |
| `sourceAgent` | Which agent wrote it. |
| `status` | `active`, `superseded`, or `disputed`. |
| `supersedes` | JSON list of claim ids this one replaced. |
| `embedding` | JSON vector stored on the row. |
| `confidence` | Stored at `1.0`. Search ranking does not change this number. |
| `lastAccessedAt` | Updated when the claim is returned from search. Used only for ranking decay. |

Three other tables:

- **`agent_authority`** — trust weight (0–1) per agent per entity. Patterns like `user.schedule.*` are allowed. The most specific match wins. Missing weight is `0`.
- **`disputes`** — audit row when authority cannot pick a winner. `claimA` is the challenger, `claimB` is the incumbent. `resolvedAt` stays null until someone calls `resolveDispute`.
- **`entities`** — optional registry of allowed keys. Off unless `useEntityRegistry: true`. The CLI demo does not turn it on.

```mermaid
stateDiagram-v2
  [*] --> active: ADD
  active --> superseded: REPLACE or recency win
  active --> active: UPDATE in place
  [*] --> disputed: authority loss
  disputed --> active: resolveDispute picks this claim
  active --> superseded: resolveDispute picks the other claim
```

Only `active` claims are in the vector index. Search never returns superseded or disputed rows.

The SQLite schema does not declare foreign keys. The links below are how the code joins the rows: `disputes` points at two claim ids, `claims.supersedes` stores the ids it replaced, and `entity` / `key` are matched as strings (authority patterns may be wildcards like `user.schedule.*`).

```mermaid
erDiagram
  ENTITIES ||--o{ CLAIMS : "key matches entity"
  ENTITIES ||--o{ AGENT_AUTHORITY : "key matches entity pattern"
  ENTITIES ||--o{ DISPUTES : "key matches entity"
  CLAIMS ||--o{ DISPUTES : "claim_b_id incumbent"
  CLAIMS ||--o{ DISPUTES : "claim_a_id challenger"
  CLAIMS ||--o{ CLAIMS : "supersedes prior claim ids"

  ENTITIES {
    text id PK
    text key UK
    text description
    text aliases
    int created_at
  }

  CLAIMS {
    text id PK
    text entity
    text text
    text type
    text source_agent
    text conversation_id
    real confidence
    text status
    text supersedes
    text embedding
    int created_at
    int last_accessed_at
  }

  AGENT_AUTHORITY {
    text id PK
    text entity
    text agent_id
    real weight
  }

  DISPUTES {
    text id PK
    text claim_a_id
    text claim_b_id
    text entity
    text resolved_op
    text resolution_strategy
    int created_at
    int resolved_at
  }
```

## Writing a memory: `Memory.add`

Each agent constructs `new Memory(agentId, { db, apiKey, entityStrategies })`. `add(messages, conversationId)` only looks at the **latest user turn** plus any assistant messages after it. Older turns are ignored for extraction.

```mermaid
flowchart TD
  M[messages] --> E[1 Extract facts with LLM]
  E --> F{for each fact}
  F --> EM[2 Embed fact text]
  EM --> R[3 Align entity label]
  R --> REG[4 Optional registry check]
  REG --> P1[5 Pass 1: classify vs own history]
  P1 -->|NOOP| STOP[stop, write nothing]
  P1 -->|UPDATE or REPLACE| APPLY[write immediately, skip pass 2]
  P1 -->|ADD| P2[6 Pass 2: other agents on same entity]
  P2 -->|no conflict| ADD[store active]
  P2 -->|recency, or higher authority| REP[supersede others, store active]
  P2 -->|lower authority| DIS[store disputed + disputes row]
```

**1. Extract.** The LLM returns `{ facts: [{ entity, text, type }] }`. With the registry on, the prompt lists known keys and the model must use one of them or `new:user.something`. Unknown keys without the `new:` prefix are rejected.

**2. Embed.** Default model is OpenAI `text-embedding-3-small` (1536 dimensions). That same vector is reused for entity alignment, classification, and the index.

**3. Align the entity.** The extractor often invents slightly different labels for the same subject (`user.abc` vs `user.timezone`). Vault searches all active claims by the fact vector:

- score ≥ **0.85** — adopt the existing claim's entity automatically
- **0.70–0.85** — ask the LLM whether it is the same subject
- below **0.70** — keep the extracted label

Set `entityMatchThreshold: 0` to skip this.

**4. Registry (optional).** If enabled, a valid new key is inserted into `entities` on first use (`entityRegistryAutoRegister` defaults to true).

**5. Pass 1 — this agent's own history.** Vector search returns the top 5 similar **active** claims from this agent only. The LLM then chooses:

| Op | Meaning | What gets written |
|---|---|---|
| `NOOP` | Already stored | Nothing |
| `UPDATE` | Refines wording, no contradiction | Same row updated in place. The old entity label is kept. |
| `REPLACE` | Contradicts this agent's own claim | Old row becomes `superseded` and leaves the index. New `active` row points at it via `supersedes`. |
| `ADD` | New for this agent | Continues to pass 2 |

`UPDATE` and `REPLACE` never go through cross-agent resolution. A diet change from the same agent ("I'm vegetarian" then "I eat meat now") is a pass-1 `REPLACE`.

**6. Pass 2 — other agents, same entity.** Search is filtered to active claims whose `entity` is exactly this one and whose `sourceAgent` is not this agent. No hits means a plain `ADD`. Hits go to the strategy for that entity.

## Conflict policy

`entityStrategies` maps an entity (or wildcard) to `recency` or `authority`. Unlisted entities use **recency**. The most specific pattern wins, same rule as authority weights.

**Recency (default).** The new claim always wins. Every conflicting active claim from other agents is marked `superseded` and removed from the index. The new claim is stored `active`. No dispute row.

**Authority.** Look up weights in `agent_authority`. The incoming agent must be **strictly heavier** than every conflicting agent. Tie or lower weight is a loss.

- Win: same as recency — supersede the others, store `active`.
- Loss: store the new claim as `disputed` and **do not index it**. The incumbent stays `active` and searchable. A `disputes` row links the two claims.

The demo seeds this:

| Entity | agent-a | agent-b | Strategy in the CLI |
|---|---|---|---|
| `user.timezone` | 0.9 | 0.2 | authority |
| `user.mood` | 0.3 | 0.8 | authority |
| everything else | — | — | recency |

Worked example: agent-a says "I'm in PST" and stores an active `user.timezone` claim. Agent-b says "I'm in EST". Pass 1 is `ADD` because agent-b has no prior timezone claim. Pass 2 finds agent-a. Weight 0.2 does not beat 0.9, so agent-b's claim is `disputed`. `/search what timezone is the user in?` still returns PST.

A human or app later calls `resolveDispute(db, vectorStore, disputeId, winningClaimId)`. The winner becomes `active` and indexed. The loser becomes `superseded`.

## Search

`memory.search(query)` embeds the query, searches this agent's active claims, hydrates full rows from SQL, then re-ranks.

Ranking multiplies the vector score by an exponential decay with a ~30-day half-life, based on `lastAccessedAt` (or `createdAt` if never accessed). The stored `confidence` is not changed. Returned claims then get `lastAccessedAt` bumped, so frequently used facts rank higher next time.

The CLI's `/search` does not use `memory.search`. It calls `searchSharedStore`, which searches **all agents'** active claims. That is the shared view of "what does the store currently believe."

FAISS uses `IndexFlatIP` (exact inner product). Vectors are L2-normalized first, so inner product equals cosine similarity. Filters (agent, entity, status) are applied in JavaScript after a slightly larger candidate pull. There is also `MemoryVectorStore` (pure JS cosine, for tests) and `PgVectorStore` (`vault-memory/pg`) when Postgres plus pgvector should be the shared index instead of a per-process FAISS cache.

## How the CLI wires it

1. `agent-a.ts` / `agent-b.ts` call `runCli` with a fixed agent id and `vault-shared.db`.
2. `createDb` opens SQLite and creates `claims`, `agent_authority`, and `disputes` if missing. The `entities` table is not created here.
3. `bootstrapSharedStore` inserts the authority seed once, if the authority table is empty.
4. `createAgentMemory` builds one `Memory` plus one `FaissVectorStore`, and sets timezone and mood to `authority`.
5. The readline loop:
   - plain text → `memory.add` after rebuilding the index
   - `/search` → shared search across agents
   - `/claims` and `/disputes` → dump SQL rows
   - the "assistant" reply is only a receipt of what was stored. This demo does not run a chat model over the memories.

Because each process owns its FAISS index, a write in terminal 1 is invisible to terminal 2 until terminal 2 rebuilds from SQLite. That rebuild is why the CLI calls `vectorStore.rebuild(db)` before every add and search.

## What you would call from your own agent

```typescript
const memory = new Memory("agent-a", {
  db,                              // Drizzle over SQLite or Postgres
  apiKey: process.env.OPENAI_API_KEY,
  entityStrategies: { "user.timezone": "authority" },
});

await memory.add(
  [{ role: "user", content: "I'm vegetarian" }],
  "conversation-1",
);

const hits = await memory.search("what does the user eat?");
```

`update` and `delete` only touch claims whose `sourceAgent` is this agent, and they keep the vector index in sync. Cross-agent search is the exported `search()` function with no `sourceAgent` filter.
