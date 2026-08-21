# Publishing

How to version and release `vault-memory` to npm.

## Package

- **Name:** `vault-memory`
- **Registry:** npm (public)
- **Source:** `packages/vault-memory/`
- **Shipped files:** `dist/`, `README.md`, `LICENSE` only (no `docs/` in tarball)

## Versioning (Changesets)

The monorepo uses [Changesets](https://github.com/changesets/changesets).

```bash
# From repo root — add a changeset after meaningful changes
bun run changeset

# Apply version bump + CHANGELOG
bun run version-packages

# Build + publish
bun run release
```

Config: `.changeset/config.json` — `cli-agent` is ignored; only `vault-memory` is versioned.

### Breaking changes

Schema additions (new tables) are **breaking** for consumers who ran migrations against older schema. Ship as minor bump on 0.x (e.g. `0.1.0` → `0.2.0`) with explicit migration notes in the changeset.

Example changeset content for multi-agent release:

- New tables: `agent_authority`, `disputes`
- Migration: `drizzle-kit generate` + `push`
- New config: `vectorStore`, `entityStrategies`
- Default FAISS backend

## Pre-publish checklist

```bash
cd packages/vault-memory
bun run build
bun test
bun run typecheck
bun run verify:consumer
```

`verify:consumer`:

1. `npm pack` the package
2. Install tarball in a temp directory
3. Run single-agent smoke test
4. Run two-agent conflict scripts on shared SQLite (`agent-a.mjs`, `agent-b.mjs`, `verify-conflict.mjs`)

Uses `MemoryVectorStore` in scratch install to avoid FAISS native binding issues in CI-like environments.

## Publish commands

From package directory:

```bash
cd packages/vault-memory
bun run build
npm publish --access public
# or: bun run publish:public
```

From monorepo root:

```bash
bun run release   # build --filter=vault-memory && changeset publish
```

## Post-publish verification

```bash
mkdir /tmp/vault-scratch && cd /tmp/vault-scratch
npm init -y
npm install vault-memory@latest better-sqlite3 drizzle-orm
```

Or re-run `bun run verify:consumer` locally (tests packed tarball, not registry — run after publish to confirm registry if needed).

## Consumer upgrade path (document in CHANGELOG)

```bash
npm install vault-memory@latest
npx drizzle-kit generate
npx drizzle-kit push
```

Existing `claims` rows remain valid. Seed `agent_authority` for multi-agent authority strategy.

## Related

- [Schema](./schema.md) — migration details
- [packages/vault-memory/CHANGELOG.md](../packages/vault-memory/CHANGELOG.md) — release notes
- [plan2.md](../plan2.md) §8 — packaging design notes
