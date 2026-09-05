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

`examples/vite.config.ts` deliberately bypasses the published `lib/` for a few packages so HMR picks up source changes without a rebuild:

| Package | Resolves to |
|---------|-------------|
| `@toolcase/web-components` | `../web-components/src/index.ts` |
| `@toolcase/web-components/react` | `../web-components/src/react.ts` |
| `@toolcase/web-components/style.css` | `../web-components/lib/index.css` |
| `@toolcase/phaser-plus` | `../phaser-plus/src/index.ts` |
| `@toolcase/node` | `../node/src/main.iso.ts` |

The other packages (`base`, `logging`, `serializer`) resolve through their `lib/` builds via npm workspaces — **you must `npm -w <pkg> run build`** for changes to those to show up here. The `web-components` *stylesheet* still resolves to its built `lib/index.css`, so after editing SCSS run `npm -w @toolcase/web-components run build:css`.

## Routes

| Route | Page |
|-------|------|
| `/` | Landing — links to every package. |
| `/base` | `@toolcase/base` showcase — `AdjacencyMatrix`, `State`, `Cache`, `retry`, `JSONSchema`, `env`, packing helpers, etc. |
| `/logging` | `@toolcase/logging` levels, scoped loggers, custom reporters. |
| `/serializer` | `@toolcase/serializer` schema definition + encode/decode playground. |
| `/web-components` | All `@toolcase/web-components` `tc-*` elements, grouped by complexity, one demo each. |
| `/web-components/:key` | Per-component deep-dive page. |
| `/phaser-plus` | `@toolcase/phaser-plus` API + live Phaser scenes. |
| `/node` | `@toolcase/node` backend-helper walkthroughs. |

## React compatibility harnesses (dev only)

Eight pages under `examples/dev/` drive every `tc-*` element from React and assert
what react-dom actually does to a host it owns. They are **not** part of the built
site — Vite only bundles `index.html` — so they exist purely to be opened against
`npm -w @toolcase/examples run dev`.

| Page | Pass | What it proves |
|------|------|----------------|
| `/react-stress.html` | A | Mount with a keyed child list, then attribute write → insert → reorder → remove → unmount, in three child vocabularies (inline, interactive, structural). Catches any element that moves, wraps or drops a node react-dom owns. |
| `/react-props.html` | B | Writes every value React can hand a prop (`undefined`, `null`, `0`, `''`, `'false'`, `NaN`, `[]`, `{}`, …) into every setter of every element. Rule 4. |
| `/react-remount.html` | C | Three disconnect/reconnect cycles per element, with and without `StrictMode` — a changed `key`, a route change, a portal move. Catches markup that duplicates, vanishes, or comes back inert. |
| `/react-controlled.html` | D | The controlled-input contract: a value React declares at mount, on a later render, and while the control has focus all reach the real control. |
| `/react-demos.html` | E | Every demo in `src/web-components/` through mount → re-render → unmount → remount under `StrictMode`. |
| `/react-differential.html` | F | Renders each element empty and with one child and compares its own chrome — catches a light-DOM walk that mis-aligns and drops its own markup when a consumer child is present. |
| `/react-adopted.html` | G | The seven adopting elements: children land in the right container, the element still *works* (menu opens, panel collapses, carousel advances), and it survives React inserting, reordering and removing children. |
| `/react-derived.html` | H | Anything an element copied out of the consumer's content — a derived `aria-label`, a highlighted code block, an option list — is re-derived when React rewrites the children. Rule 6. |

Every page reports to `#out` and leaves its raw results on `window` (`__stress`,
`__props`, `__remount`, `__controlled`, `__demos`, `__diff`, `__adopted`,
`__derived`) for querying from devtools or a driver.

`?tags=tc-dropdown,tc-navbar` narrows any tag-driven page to those elements, which
is how a single fix gets checked in seconds; `/react-adopted.html?only=tc-carousel`
does the same there. A full sweep is the regression gate.

The static counterpart runs in CI:

```bash
npm -w @toolcase/web-components run check:react-safety
```

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
