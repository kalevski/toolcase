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
npm -w @toolcase/base run dev                     # tsup --watch
npm -w @toolcase/web-components run build:css     # rebuild only the SCSS bundle
npm -w @toolcase/phaser-plus run typecheck        # tsc --noEmit
npm -w @toolcase/examples run dev                 # vite dev server (examples site)
npm -w @toolcase/examples run build               # produces examples/dist for GH Pages
```

Single test file: `npx vitest run path/to/file.test.ts` (or `npx vitest path/to/file.test.ts` for watch mode). Vitest is configured at the root and discovers tests across workspaces; tests currently live in `base/test/`.

## Workspace layout

Seven npm workspaces declared in the root `package.json`:

| Workspace | Published name | Purpose |
|---|---|---|
| `base/` | `@toolcase/base` | Zero-dep helpers + data structures (browser + Node, isomorphic). |
| `logging/` | `@toolcase/logging` | Isomorphic logger. Default export is a singleton `LoggerFactory` with one `ConsoleLogReporter`. |
| `serializer/` | `@toolcase/serializer` | Runtime protobuf schemas via `protobufjs/light`. |
| `web-components/` | `@toolcase/web-components` | Framework-free HTML5 `tc-*` Web Components with from-scratch toolcase styling + a Bootstrap-compatible class/grid API. Ships JS + a separate `style.css`. |
| `phaser-plus/` | `@toolcase/phaser-plus` | Phaser 4 runtime layer (Scene lifecycle, FeatureRegistry, Flow, AI, Effects, Cinema, Input). |
| `node/` | `@toolcase/node` | Node backend helpers — Fastify endpoints, raw-SQL repositories, Redis KV service, OAuth2/OIDC, image transforms, isomorphic sanitize/pagination utils. |
| `examples/` | `@toolcase/examples` (private) | Vite + React 19 demo site, deployed to `toolcase.kalevski.dev`. |

All published packages are at version **4.0.0**. Inter-package peer dependencies (relevant when changing public surface):

- `web-components` peers `@toolcase/base 4.x.x`; `react` is an optional peer (only for the `@toolcase/web-components/react` JSX-typings entry).
- `phaser-plus` peers `@toolcase/base 4.x`, `@toolcase/logging 4.x`, `phaser 4.x`. `react`/`react-dom` are optional peers.
- `node` peers `@toolcase/base ^4.0.0`, `@toolcase/serializer ^4.0.0`, plus `fastify`, `@fastify/cors`, `jose`, `redis`, `sharp`.
- `examples` consumes every workspace via the `*` workspace protocol.

## Build system

Most packages are bundled with **tsup** (see each `tsup.config.js`), producing CJS + ESM + `.d.ts` into `lib/`. Two exceptions:

- `phaser-plus` builds with **tsc** (`tsconfig.build.json`), ESM-only — its `package.json` has `"type": "module"` and a single `import` export.
- `web-components` runs **tsup** for code _and_ a separate **sass** invocation for `style/index.scss → lib/index.css` (the `style.css` export). The `build` script chains both; `build:css` rebuilds just the stylesheet.

`lint:exports` (publint) validates the published export maps for every package except `examples`. Run it before bumping versions.

The root `tsconfig.json` is shared (strict, ES2020 target, ESNext modules, `jsx: react`). Each workspace adds its own `tsconfig.json`/`tsconfig.build.json` for emit settings.

## Examples site — Vite source aliases

`examples/vite.config.ts` deliberately bypasses the published `lib/` for the source-resolved packages:

```ts
'@toolcase/web-components'           → '../web-components/src/index.ts'
'@toolcase/web-components/react'     → '../web-components/src/react.ts'
'@toolcase/web-components/style.css' → '../web-components/lib/index.css'
'@toolcase/phaser-plus'              → '../phaser-plus/src/index.ts'
'@toolcase/node'                     → '../node/src/main.iso.ts'
```

So the demo site picks up `web-components`, `phaser-plus`, and `node` source changes without rebuilding those workspaces. **Exception:** the `web-components` *stylesheet* still resolves to its built `lib/index.css`, so after editing SCSS run `npm -w @toolcase/web-components run build:css`. The other packages (`base`, `logging`, `serializer`) resolve through `lib/` via npm workspaces — run `npm -w <pkg> run build` for changes to be visible in `examples/`.

## SKILL.md publishing pipeline

Each package has a `SKILL.md` reference under `examples/public/<package>/SKILL.md`. These files are served as static assets from the deployed examples site (`toolcase.kalevski.dev/<package>/SKILL.md`) and consumed by Claude Code as installable skills — the package's docs page (`examples/src/pages/<X>Page.tsx`) shows the install curl command pointing at that exact URL.

Implications when editing:

- The path matters — `web-components/SKILL.md` must contain web-components content, etc. Don't reorganize without updating the page-level `SKILL_URL` constants.
- A single combined top-level `examples/public/SKILL.md` is **not** in the install paths; per-package files are the canonical surface.
- Each `SKILL.md` is a YAML-frontmatter doc (`name`, `description`) followed by a full API reference + worked examples.

Deployment: `.github/workflows/deploy-examples.yml` builds `examples/dist` on push to `main` and pushes it to the `public` branch (GitHub Pages source).

## web-components conventions (load before editing)

`web-components/styleguide.md` is the authoritative spec for new/modified `tc-*` components. Hard rules that aren't obvious from the code:

- **No `border-radius`** anywhere except genuinely circular/pill shapes (radio dots, spinner rings, switch tracks, avatars, the brand dot). Sharp corners are a mandate, not a preference.
- **Light DOM, global stylesheet.** Components render Bootstrap-compatible classnames into their light DOM; `style.css` paints them. No shadow roots. New tags need an explicit `display` registered in `foundation/_reset.scss` (custom elements default to `display: inline`).
- Two CSS variable families: `--tc-*` are the design-system tokens (source of truth); `--bs-<component>-*` are the Bootstrap-compatible theming contract — drive all cosmetics through them so themes re-skin via vars alone. Don't invent new prefixes.
- Z-index values are fixed (Tooltip 1070 > Dropdown 1060 > Modal 1055 > Backdrop 1050 > Sticky 1020), exposed as `--tc-z-*`. Don't add new layers.
- Icons are inline SVG via `src/icons.ts` (lucide-static, `stroke="currentColor"`) — never `background-image` glyphs, never emoji.
- Mobile-first; touch targets ≥ 44px under `@media (pointer: coarse)`; focus always visible; honour `prefers-reduced-motion`.
- Adding a component requires four touchpoints: `src/<Name>.ts` + registration in `src/register.ts`, `style/components/_<name>.scss` + `style/components/_index.scss` forward, `src/index.ts` export, plus a demo at `examples/src/web-components/<Name>Demo.tsx` registered in `examples/src/web-components/index.tsx`, plus an entry in `examples/public/web-components/SKILL.md`.

## Code style

- 4-space indentation (enforced via prettier).
- ESLint allows `any` (`@typescript-eslint/no-explicit-any: off`) and ignores unused vars prefixed with `_`.
- All packages target `node >= 18`.
- `sideEffects: false` on every package except `web-components` (`*.css` + entry files that register custom-element globals).
