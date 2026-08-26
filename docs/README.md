# Vault documentation

Internal documentation for the Vault monorepo and `vault-memory` npm package.

## Start here

| Doc | Who it's for |
|-----|--------------|
| [Team onboarding](./onboarding.md) | **Full pointwise walkthrough** — explain Vault to a new teammate |
| [Getting started](./getting-started.md) | Install, first run, quick commands |
| [Architecture](./architecture.md) | How the system fits together end-to-end |
| [Pipeline](./pipeline.md) | **Full `Memory.add()` / `search()` reference** with examples |
| [Entities](./entities.md) | How `user.timezone`-style keys are chosen and used |

## Core concepts

| Doc | Topic |
|-----|--------|
| [Multi-agent conflict](./multi-agent-conflict.md) | Two-pass classify, recency vs authority, disputes |
| [Vector store](./vector-store.md) | FAISS default, opt-outs, rebuild, Postgres path |
| [Schema](./schema.md) | Tables, migrations, upgrading from v0.1.x |

## Using Vault

| Doc | Topic |
|-----|--------|
| [API reference](./api.md) | `Memory` class, config, exports |
| [CLI demo](./cli-demo.md) | Two-terminal multi-agent walkthrough |
| [Manual testing](./manual-testing.md) | Automated + E2E test checklist |

## Operations

| Doc | Topic |
|-----|--------|
| [Publishing](./publishing.md) | Changesets, npm release, consumer verification |

## Related (outside this folder)

| Location | Contents |
|----------|----------|
| [packages/vault-memory/README.md](../packages/vault-memory/README.md) | Public npm package docs (shipped with tarball) |
| [packages/vault-memory/docs/multi-agent-conflict.md](../packages/vault-memory/docs/multi-agent-conflict.md) | Package-level conflict deep-dive (internal, not published) |
| [plan1.md](../plan1.md) | Phase 1 design notes (single-agent foundation) |
| [plan2.md](../plan2.md) | Phase 2 design notes (multi-agent + FAISS) |
| [apps/cli-agent/README.md](../apps/cli-agent/README.md) | CLI app quick reference |
