# @toolcase/examples

Interactive demo site for every `@toolcase/*` package. **Vite + React 19**, deployed via GitHub Actions to **[toolcase.kalevski.dev](https://toolcase.kalevski.dev)**.

This package is **private** — it is not published to npm. Its job is two-fold:

1. Showcase each library at a public URL with live demos and full SKILL.md docs.
2. Serve as the canonical place to develop new components/features against (Vite HMR with source-aliased local packages).

## Run locally

```bash
# from the monorepo root
npm install
npm run build       # build every package once

npm -w @toolcase/examples run dev    # vite dev server
# or
cd examples && npm run dev
```

Build the static site:

```bash
npm -w @toolcase/examples run build  # outputs examples/dist
```

## Source aliases (Vite)

`examples/vite.config.ts` deliberately bypasses the published `lib/` for two packages so HMR picks up source changes without a rebuild:

| Package | Resolves to |
|---------|-------------|
| `@toolcase/game-components` | `../game-components/src/index.ts` |
| `@toolcase/game-components/style.css` | `../game-components/lib/index.css` |
| `@toolcase/phaser-plus` | `../phaser-plus/src/index.ts` |

The other packages (`base`, `logging`, `serializer`, `react-components`) resolve through their `lib/` builds via npm workspaces — **you must `npm -w <pkg> run build`** for changes to those to show up here.

## Routes

| Route | Page |
|-------|------|
| `/` | Landing — links to every package. |
| `/base` | `@toolcase/base` showcase — `AdjacencyMatrix`, `State`, `Cache`, `retry`, `JSONSchema`, `env`, packing helpers, etc. |
| `/logging` | `@toolcase/logging` levels, scoped loggers, custom reporters. |
| `/serializer` | `@toolcase/serializer` schema definition + encode/decode playground. |
| `/react-components` | All `@toolcase/react-components` exports, with one demo per component. |
| `/react-components/:key` | Per-component deep-dive page. |
| `/game-components` | `@toolcase/game-components` Web Components grid. |
| `/phaser-plus` | `@toolcase/phaser-plus` API + live Phaser scenes. |

## SKILL.md publishing

Each package ships a [Claude Code skill](https://claude.com/claude-code) at:

```
examples/public/<package>/SKILL.md   →   toolcase.kalevski.dev/<package>/SKILL.md
```

These are the canonical "agent-readable" API references. The per-package docs page (`pages/<X>Page.tsx`) renders the install command pointing at that exact URL — don't reorganize the file paths without updating the page-level `SKILL_URL` constants.

## Deployment

`.github/workflows/deploy-examples.yml` builds `examples/dist` on every push to `main` and pushes it to the `public` branch (GitHub Pages source). The custom domain is configured via `examples/public/CNAME`.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
