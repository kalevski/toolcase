# Contributing to toolcase

Thanks for taking the time to contribute! This monorepo hosts several focused packages — `@toolcase/base`, `@toolcase/logging`, `@toolcase/serializer`, `@toolcase/node`, `@toolcase/react-components`, `@toolcase/game-components`, `@toolcase/phaser-plus`, and the `examples/` site.

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
npm -w @toolcase/react-components run build:css  # rebuild only the SCSS bundle
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
- `sideEffects: false` on every package except `react-components` (CSS) and `game-components` (CSS + custom-element registration files).
- All packages target **Node ≥ 18**.

### `react-components` design rules

`.github/agents/components.agent.md` is authoritative. Hard rules to remember:

- **No `border-radius`** anywhere except intentionally circular shapes.
- BEM classnames: root carries `component component-{name}`; children are `component-{name}__{part}`; modifiers `--{state}`.
- Mobile-first SCSS only (`min-width` queries). Touch targets ≥ 44px under `@media (pointer: coarse)`.
- Z-index layers are fixed (Tooltip 1070 > Dropdown 1060 > Modal content 1055 > Modal backdrop 1050). Don't add new ones.
- Adding a component requires touching: `src/<Name>.tsx`, `style/components/_<name>.scss`, `style/components/index.scss`, `src/index.ts`, a demo under `examples/src/react-components/<Name>Demo.tsx` (registered in `examples/src/react-components/index.tsx`), and an entry in `examples/public/react-components/SKILL.md`.

### `game-components` design rules

- Vanilla HTML5 + Shadow DOM, no external libraries.
- Every component that registers an observer or listener in `connectedCallback` must clean up in `disconnectedCallback` (typically via an `AbortController`).
- New components must be added to `examples/public/game-components/SKILL.md`.

## Pull request flow

1. Fork the repo and branch off `main`.
2. Make your change. Keep PRs focused — one logical change per PR.
3. Run `npm run lint && npm test && npm run build` locally before pushing.
4. Open a PR against `main`. CI runs lint, build, tests, and `lint:exports`.
5. PR titles should describe the change concretely (e.g. `react-components: add DateRangePicker`).

## Releases

Each package version-bumps independently. Maintainers publish via `npm publish --workspace <pkg>` after merging to `main`. Use semver — patch for bug fixes, minor for additive API, major for breaking changes.

## Reporting bugs and security issues

- Functional bugs: open an issue at https://github.com/kalevski/toolcase/issues.
- Security vulnerabilities: see [SECURITY.md](./SECURITY.md) — please do **not** open a public issue.

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
