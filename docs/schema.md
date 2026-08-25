# Schema

Database tables, migrations, and upgrade path.

Vault does **not** ship a database — you bring Drizzle + SQLite or Postgres. Schema is exported from `vault-memory/schema`.

## Tables

### `claims` (Phase 1)

Core fact storage.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | Claim UUID |
| `entity` | text | Dotted path key, e.g. `user.timezone` |
| `text` | text | Human-readable fact statement |
| `type` | enum | `semantic` or `episodic` |
| `source_agent` | text | Which agent wrote this |
| `conversation_id` | text | Source conversation |
| `confidence` | real | Default 1.0 |
| `status` | enum | `active`, `superseded`, `disputed` |
| `supersedes` | text | ID of claim this replaced |
| `embedding` | text | JSON array of floats |
| `created_at` | timestamp | When stored |
| `last_accessed_at` | timestamp | Updated on search return (decay) |

### `agent_authority` (Phase 2)

Per-agent trust weights for conflict resolution.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | Row UUID |
| `entity` | text | Exact entity or wildcard (`user.schedule.*`) |
| `agent_id` | text | Agent identifier |
| `weight` | real | 0–1 trust score |

### `disputes` (Phase 2)

Audit trail when authority cannot resolve a conflict.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | Dispute UUID |
| `claim_a_id` | text | Incoming (disputed) claim |
| `claim_b_id` | text | Incumbent (active) claim |
| `entity` | text | Subject of conflict |
| `resolved_op` | text | `null` until resolved |
| `resolution_strategy` | text | e.g. `authority` |
| `created_at` | timestamp | When opened |
| `resolved_at` | timestamp | `null` until resolved |

### `entities` (entity registry)

Canonical entity taxonomy for constrained extraction.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | Row UUID |
| `key` | text unique | Canonical entity key, e.g. `user.timezone` |
| `description` | text | Human/LLM-readable subject description |
| `aliases` | text | Optional JSON array of alternate labels |
| `created_at` | timestamp | When registered |

Seed with `seedEntities(db, seeds)` from `vault-memory`. Enable with `useEntityRegistry: true` on `Memory` config.

## Drizzle import

```typescript
import { claims, agentAuthority, disputes, entities } from "vault-memory/schema";
```

## Creating tables

### Option A — Drizzle migrations (recommended)

```bash
npm install vault-memory drizzle-orm drizzle-kit better-sqlite3
```

Configure `drizzle.config.ts` to import schema from `vault-memory/schema`, then:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### Option B — raw SQL (dev / tests)

See `packages/vault-memory/test/helpers/db.ts` for the full CREATE TABLE statements used in tests.

## Upgrading from v0.1.x → v0.2.0

**Breaking schema change** — new tables required.

Existing `claims` rows are valid as-is (`sourceAgent` was already populated in Phase 1). Upgrade is **additive at the data level**, not a rewrite.

```bash
npm install vault-memory@latest
npx drizzle-kit generate   # picks up agentAuthority + disputes
npx drizzle-kit push
```

After migration, seed authority if you want multi-agent authority strategy:

```typescript
import { seedAuthority, EXAMPLE_AUTHORITY_SEED } from "vault-memory";
await seedAuthority(db, EXAMPLE_AUTHORITY_SEED);
```

## Claim status semantics

| Status | Indexed? | Searchable as active? |
|--------|----------|----------------------|
| `active` | Yes | Yes |
| `superseded` | No (removed from index) | No (filter `status: active`) |
| `disputed` | No | No — incumbent remains active winner |

## Design notes

- Phase 1 schema was **multi-agent-ready from day one** (`sourceAgent`, `supersedes`, `disputed` status existed but were unused until Phase 2)
- Disputes are a separate table (not just a status flag) for audit: "what conflicted with what and how"
- Embeddings in SQL remain canonical even when using FAISS or pgvector as the search index

## Related

- [Multi-agent conflict](./multi-agent-conflict.md) — how tables are used at runtime
- [Publishing](./publishing.md) — changelog for schema breaking changes
- Source: `packages/vault-memory/src/db/schema.ts`
