# Contributing to toolcase

Thanks for taking the time to contribute! This monorepo hosts several focused packages — `@toolcase/base`, `@toolcase/logging`, `@toolcase/serializer`, `@toolcase/node`, `@toolcase/web-components`, `@toolcase/phaser-plus`, and the `examples/` site.

## Prerequisites

- Node.js **≥ 18** (CI runs on Node 20).
- `npm` (this repo uses npm workspaces).

## Setup

```bash
git clone https://github.com/kalevski/toolcase.git
cd toolcase
npm install
```

## Daily workflow

Run from the repo root:

```bash
npm run build           # build every workspace
npm test                # vitest run, all packages
npm run lint            # eslint .
npm run lint:exports    # publint each published package
npm run format          # prettier --write .
```

Per-package work uses workspace flags (or `cd` into the package):

```bash
npm -w @toolcase/base run dev                    # tsup --watch
npm -w @toolcase/web-components run build:css    # rebuild only the SCSS bundle
npm -w @toolcase/phaser-plus run typecheck       # tsc --noEmit
npm -w @toolcase/examples run dev                # vite dev server (examples site)
```

To run a single test file:

```bash
npx vitest run path/to/file.test.ts
npx vitest path/to/file.test.ts   # watch mode
```

## Repository conventions

- **4-space indentation**, enforced via Prettier.
- ESLint allows `any` and ignores unused vars prefixed with `_`.
- `sideEffects: false` on every package except `web-components` (CSS + custom-element registration files).
- All packages target **Node ≥ 18**.

### `web-components` design rules

`web-components/styleguide.md` is authoritative. Hard rules to remember:

- **No `border-radius`** anywhere except genuinely circular/pill shapes (radio dots, spinner rings, switch tracks, avatars, the brand dot). Sharp corners are a mandate, not a preference.
- **Light DOM, global stylesheet** — `tc-*` elements render Bootstrap-compatible classnames into their light DOM; `style.css` paints them. No shadow roots.
- All cosmetics flow through `--bs-<component>-*` custom properties (the public theming contract); design-system tokens are `--tc-*`. Don't invent new prefixes.
- Z-index layers are fixed (Tooltip 1070 > Dropdown 1060 > Modal 1055 > Backdrop 1050 > Sticky 1020), exposed as `--tc-z-*`. Don't add layers.
- Icons are inline SVG via `src/icons.ts` (lucide-static, `stroke="currentColor"`) — never `background-image` glyphs. No emoji.
- Touch targets ≥ 44px under `@media (pointer: coarse)`; focus always visible; honour `prefers-reduced-motion`.
- Adding a component requires four touchpoints: `src/<Name>.ts` + registration in `src/register.ts`, `style/components/_<name>.scss` + `style/components/_index.scss` forward, a demo under `examples/src/web-components/<Name>Demo.tsx`, and an entry in `examples/public/web-components/SKILL.md`.

## Pull request flow

1. Fork the repo and branch off `main`.
2. Make your change. Keep PRs focused — one logical change per PR.
3. Run `npm run lint && npm test && npm run build` locally before pushing.
4. Open a PR against `main`. CI runs lint, build, tests, and `lint:exports`.
5. PR titles should describe the change concretely (e.g. `web-components: add tc-date-range-picker`).

## Releases

Each package version-bumps independently. Maintainers publish via `npm publish --workspace <pkg>` after merging to `main`. Use semver — patch for bug fixes, minor for additive API, major for breaking changes.

## Reporting bugs and security issues

- Functional bugs: open an issue at https://github.com/kalevski/toolcase/issues.
- Security vulnerabilities: see [SECURITY.md](./SECURITY.md) — please do **not** open a public issue.

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
