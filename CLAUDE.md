# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root unless noted:

```bash
npm install                      # install all workspace deps
npm run build                    # build every workspace
npm test                         # vitest run (single shot, all packages)
npm run lint                     # eslint .
npm run lint:exports             # publint each published package
npm run format                   # prettier --write .
```

Per-package work happens with `npm -w <package>` or by `cd`ing in:

```bash
npm -w @toolcase/base run dev          # tsup --watch
npm -w @toolcase/react-components run build:css   # rebuild only the SCSS bundle
npm -w @toolcase/phaser-plus run typecheck        # tsc --noEmit
npm -w @toolcase/examples run dev                 # vite dev server (examples site)
npm -w @toolcase/examples run build               # produces examples/dist for GH Pages
```

Single test file: `npx vitest run path/to/file.test.ts` (or `npx vitest path/to/file.test.ts` for watch mode). Vitest is configured at the root and discovers tests across workspaces; tests currently live in `base/test/`.

## Workspace layout

Seven npm workspaces declared in the root `package.json`:

| Workspace | Published name | Purpose |
|---|---|---|
| `base/` | `@toolcase/base` | Zero-dep helpers + data structures. Has a Node-only subpath `@toolcase/base/node` (env loader). |
| `logging/` | `@toolcase/logging` | Isomorphic logger. Default export is a singleton `LoggerFactory` with one `ConsoleLogReporter`. |
| `serializer/` | `@toolcase/serializer` | Runtime protobuf schemas via `protobufjs/light`. |
| `react-components/` | `@toolcase/react-components` | React 18+/Bootstrap 5 UI library. Ships JS + a separate `style.css`. |
| `game-components/` | `@toolcase/game-components` | Framework-free `gc-*` Web Components for game UI. |
| `phaser-plus/` | `@toolcase/phaser-plus` | Phaser 4 runtime layer (Scene lifecycle, FeatureRegistry, Flow, AI, Effects, Cinema, Input). |
| `examples/` | `@toolcase/examples` (private) | Vite + React 19 demo site, deployed to `toolcase.kalevski.dev`. |

Inter-package peer dependencies (relevant when changing public surface):

- `react-components` peers `@toolcase/base ^2.x`.
- `phaser-plus` peers `@toolcase/base ^2.x`, `@toolcase/logging ^2.x`, `phaser ^4.x`. `react`/`react-dom` are optional peers.
- `game-components` peers `@toolcase/base ^2.x`.
- `examples` consumes every workspace via the `*` workspace protocol.

## Build system

Most packages are bundled with **tsup** (see each `tsup.config.js`), producing CJS + ESM + `.d.ts` into `lib/`. Two exceptions:

- `phaser-plus` builds with **tsc** (`tsconfig.build.json`), ESM-only — its `package.json` has `"type": "module"` and a single `import` export.
- `react-components` runs **tsup** for code _and_ a separate **sass** invocation for `style/index.scss → lib/index.css` (the `style.css` export). The `build` script chains both.

`base.publint`/`lint:exports` validates the published export maps for every package except `examples`. Run it before bumping versions.

The root `tsconfig.json` is shared (strict, ES2020 target, ESNext modules, `jsx: react`). Each workspace adds its own `tsconfig.json`/`tsconfig.build.json` for emit settings.

## Examples site — Vite source aliases

`examples/vite.config.ts` deliberately bypasses the published `lib/` for two packages:

```ts
'@toolcase/game-components' → '../game-components/src/index.ts'
'@toolcase/game-components/style.css' → '../game-components/lib/index.css'
'@toolcase/phaser-plus' → '../phaser-plus/src/index.ts'
```

So the demo site picks up `game-components` and `phaser-plus` source changes without rebuilding those workspaces. The other packages (`base`, `logging`, `serializer`, `react-components`) resolve through `lib/` via npm workspaces — you must run `npm -w <pkg> run build` for changes to be visible in `examples/`.

## SKILL.md publishing pipeline

Each package has a `SKILL.md` reference under `examples/public/<package>/SKILL.md`. These files are served as static assets from the deployed examples site (`toolcase.kalevski.dev/<package>/SKILL.md`) and consumed by Claude Code as installable skills — the package's docs page (`examples/src/pages/<X>Page.tsx`) shows the install curl command pointing at that exact URL.

Implications when editing:

- The path matters — `react-components/SKILL.md` must contain react-components content, etc. Don't reorganize without updating the page-level `SKILL_URL` constants.
- A single combined top-level `examples/public/SKILL.md` is **not** in the install paths; per-package files are the canonical surface.
- Each `SKILL.md` is a YAML-frontmatter doc (`name`, `description`) followed by a full API reference + worked examples.

Deployment: `.github/workflows/deploy-examples.yml` builds `examples/dist` on push to `main` and pushes it to the `public` branch (GitHub Pages source).

## react-components conventions (load before editing)

`.github/agents/components.agent.md` is the authoritative spec for new/modified React components. Hard rules that aren't obvious from the code:

- **No `border-radius`** anywhere except intentionally circular shapes (spinner rings, slider thumbs, carousel dots). This is a design rule, not a preference.
- BEM-style classnames with a strict prefix pattern: root carries both `component` and `component-{name}`; children are `component-{name}__{part}`; modifiers are `--{state}`.
- Per-component CSS custom property prefix table — `Dropdown` uses `--rc-dropdown-`, `AdvancedTable` uses `--at-`, etc. Don't invent new prefixes for existing components.
- Mobile-first SCSS only (`min-width` queries). Touch targets ≥ 44px under `@media (pointer: coarse)`.
- Z-index values are fixed (Tooltip 1070 > Dropdown 1060 > Modal content 1055 > Modal backdrop 1050). Don't add new layers.
- Adding a component requires four touchpoints: `src/<Name>.tsx`, `style/components/_<name>.scss`, `style/components/index.scss` import, `src/index.ts` export, plus a demo at `examples/src/react-components/<Name>Demo.tsx` registered in `examples/src/react-components/index.tsx`, plus an entry in `examples/public/react-components/SKILL.md`.

## Code style

- 4-space indentation (enforced via prettier).
- ESLint allows `any` (`@typescript-eslint/no-explicit-any: off`) and ignores unused vars prefixed with `_`.
- All packages target `node >= 18`.
- `sideEffects: false` on every package except `react-components` (`*.css`) and `game-components` (`*.css` + entry files that register custom-element globals).
