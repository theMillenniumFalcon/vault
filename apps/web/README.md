# Vault web

Marketing site and documentation for [Vault](https://github.com/theMillenniumFalcon/vault).

## Development

```bash
bun install
bun run dev
```

- **Site:** [http://localhost:3000](http://localhost:3000)
- **Docs:** [http://localhost:3000/docs](http://localhost:3000/docs)

Docs are served by Next.js from `docs/docs/*.mdx` (dark mode only). No separate docs server required.

## Documentation source

| Path | Purpose |
|------|---------|
| `docs/docs.json` | Mintlify config (navigation, branding) — used by Next.js sidebar and [Mintlify cloud](https://mintlify.com) |
| `docs/docs/**/*.mdx` | Documentation content (shared by both) |

### Mintlify cloud (optional)

To deploy docs on Mintlify's platform:

1. Connect the repo with monorepo path `apps/web/docs`
2. Enable **Host at** `/docs` in custom domain settings
3. Set `MINTLIFY_DOCS_URL` if proxying through another host

For local development, use `bun run dev` — the Next.js app renders the same MDX files.

### Mintlify CLI (optional)

```bash
bun run docs:mintlify
```

Requires Node.js 20–22 (the CLI currently fails on Node 24). Use Next.js `/docs` for local preview instead.

## Stack

- Next.js 16 (App Router)
- Tailwind CSS 4
- MDX via `next-mdx-remote`
- Mintlify-compatible content in `docs/`
