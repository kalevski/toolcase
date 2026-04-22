# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root unless noted. The repo is an npm workspaces monorepo (Node >=18).

- `npm install` — install all workspace deps
- `npm run build` — build every package (`npm run build --workspaces`)
- `npm test` — run the full Vitest suite (`vitest run`)
- `npm run lint` — lint all packages with ESLint 10 + typescript-eslint
- `npm run lint:exports` — `publint` check on each publishable package
- `npm run format` — Prettier across the repo

Single package / single test:

- Build one package: `npm run build -w @toolcase/base` (swap in `@toolcase/logging`, `@toolcase/serializer`, `@toolcase/react-components`)
- Watch-build one package: `npm run dev -w @toolcase/base` (tsup `--watch`)
- Run one test file: `npx vitest run base/test/Cache.test.ts`
- Run one test by name: `npx vitest run -t 'calls fetchFn on first get'`
- Examples dev server: `npm run dev -w @toolcase/examples` (Vite)
- React-components CSS only: `npm run build:css -w @toolcase/react-components`

Tests currently live only in `base/test/` (Vitest). There is no test runner config file — vitest picks up `**/*.test.ts` from the root.

## Architecture

### Monorepo layout

Four publishable packages plus a non-published demo app:

| Workspace | Package | Purpose |
|-----------|---------|---------|
| `base/` | `@toolcase/base` | Zero-dep helpers + data structures. Dual entrypoints: `.` (browser-safe) and `./node` (Node-only, e.g. `env`) |
| `logging/` | `@toolcase/logging` | Universal logger. Default export is a pre-wired `LoggerFactory` with a `ConsoleLogReporter` |
| `serializer/` | `@toolcase/serializer` | Thin wrapper around `protobufjs/light`, single-file source |
| `react-components/` | `@toolcase/react-components` | React + SCSS component library. Peers on React 18+ and `@toolcase/base` 2.x |
| `examples/` | `@toolcase/examples` (private) | Vite + React app that demos every component; deployed to GitHub Pages via `.github/workflows/deploy-examples.yml` |

### Build system (tsup)

Every publishable package uses the same tsup pattern (`{pkg}/tsup.config.js`):

- `format: ['cjs', 'esm']` with `dts: true`, `clean: true`, `outDir: 'lib'`
- Custom `outExtension`: ESM → `.module.js`, CJS → `.main.js`
- `package.json` `exports` map mirrors those filenames (`lib/main.module.js`, `lib/main.main.js`, `lib/main.d.ts`)
- `sideEffects: false` on pure-JS packages; `react-components` marks `*.css` as side-effectful
- `react-components` additionally externalizes `react`, `react-dom`, `react/jsx-runtime`, `@toolcase/base`, `dropzone`

`@toolcase/base` has two entries (`src/main.ts`, `src/node.ts`); the rest have one. Don't add `src/node.ts`-style splits elsewhere unless you also update `package.json#exports`.

### react-components specifics

- JS is built by tsup; CSS is built separately by Sass: `sass style/index.scss:lib/index.css`. The package `build` script runs both. If you change SCSS only, use `build:css`.
- Style entry `style/index.scss` `@use`s `_bootstrap`, `_reset`, `layouts`, `components`. Each component has a `style/components/_{name}.scss` partial that must be added to `style/components/index.scss`.
- Every component is one `.tsx` in `src/` exported from `src/index.ts`. Nested multi-file subsystems live in folders (`BasicLayout/`, `DashboardLayout/`, `DashboardCard/`, `Chart/`, `modal/`) with their own `index.tsx`/`index.ts`.
- Modal system is namespace-exported: `import { Modal } from '@toolcase/react-components'` → `Modal.Window`, `Modal.Context`, `Modal.Control`, hooks.
- `SKILL.md` is the human-facing component catalog (prop tables + minimal examples). **Keep it in sync** when adding/changing components.

`.github/agents/components.agent.md` is the authoritative style/a11y/SCSS/demo rulebook. The rules below are condensed from it — read the full file before generating or deeply modifying a component.

#### File-level rules

- One `.tsx` per component in `src/` (PascalCase file + named export); one `_component-name.scss` in `style/components/`, wired into `style/components/index.scss`.
- Add the export to `src/index.ts`.
- **Never** `import` SCSS inside `.tsx` files — styles are bundled through the Sass entry, not through JS.
- Shared hooks live in `src/hooks/`. Multi-file subsystems get a folder with their own `index`.

#### TypeScript patterns

- Extend HTML attributes when the root is an HTML element:
  ```tsx
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
      variant?: 'primary' | 'secondary' | 'danger'
  }
  ```
  Use `Omit<..., 'onChange'>` when overriding an HTML attribute with a different type.
- Use `React.FC<Props>` for components that don't need ref forwarding. Use `React.forwardRef<ElRef, Props>` **only** when the root is an HTML element that callers may ref — not for wrapper/layout components. Always set `.displayName` on forwardRef components.
- IDs: always `useId()`. Accept `id` from callers but fall back to the generated one. Derive related IDs from it (`${inputId}-error`).
- Prefer fully controlled components (`value` + `onChange`). Don't mix controlled/uncontrolled in the same component. Type `onChange` by the real contract (e.g. `(value: string) => void`), not the raw React event, unless forwarding the raw event.

#### CSS / class naming (BEM-style, strict)

Root element always carries **two** classes plus the caller's `className`:

```tsx
<div className={`component component-dropdown ${className || ''}`}>
```

Naming scheme:

```
.component                             ← joint root class
.component-{name}                      ← joint root namespace
.component-{name}__{part}              ← child element
.component-{name}--{modifier}          ← root state / variant
.component-{name}__{part}--{state}     ← child state
```

**Do not** use Tailwind utility classes, inline `style` for anything that could be a class, or camelCase class names.

#### SCSS template

```scss
// ── ComponentName ────────────────────────────────────────────────────────
.component.component-{name} {
    --cn-color: #1e293b;
    --cn-muted: #64748b;
    --cn-border: #e2e8f0;
    --cn-transition: 0.15s ease;
    position: relative;
}

.component-{name} {
    &__{part} { /* child */ }
    &--{modifier} { /* root modifier */ }
}

@media (max-width: 576px) {
    .component-{name} { /* ... */ }
}
```

- CSS custom properties use the pattern `--{abbreviation}-{semantic}`, where semantic ∈ {`color`, `muted`, `border`, `bg`, `hover-bg`, `active-color`, `active-border`, `transition`, `shadow`, `radius`}. Existing abbreviations include `--rc-dropdown-`, `--at-` (AdvancedTable), `--pg-` (Pagination), `--side-nav-`, `--fi-` (FormInput), `--es-` (ExtendedSelect) — reuse the convention.
- Inside SCSS use `$variable`s from `style/_colors.scss`. Inside CSS custom properties use the literal hex that matches (planned CSS-01 migration will swap these). Preferred neutrals: `#1e293b` (dark text), `#64748b` (muted), `#94a3b8` (faint), `#e2e8f0` (border), `#f8fafc` (surface), `#ffffff` (white).
- **No `border-radius` on rectangular elements — ever.** Sharp corners by design. Don't add `--*-radius` custom props or reference `--rc-radius-*`. Exception: `border-radius: 50%` on intentionally circular elements (spinner rings, slider thumbs, stepper indicators, carousel dots/arrows, lightbox close/arrow buttons).

#### Responsiveness

- Breakpoints (mobile-first, `min-width`): xs 400, sm 576, md 768, lg 992, xl 1200.
- Don't write desktop-first `max-width` overrides — define mobile base, override up.
- Touch targets: `@media (pointer: coarse)` → `min-width: 44px; min-height: 44px` (WCAG 2.5.5). Don't hard-code small `height: 36px` on interactive elements.
- Scrollable containers: `overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin;`.

#### Accessibility (non-negotiable)

- Form inputs: `<label htmlFor={inputId}>`; on error set `aria-invalid={true}` + `aria-describedby={errorId}`; required fields get `aria-required={true}` and a visual asterisk.
- Buttons must be real `<button>`. Non-button interactives acting as buttons need `role="button"` and `tabIndex={0}`.
- Every interactive element gets a visible `:focus-visible` — `outline: 2px solid #1e293b; outline-offset: 2px;`. Never `outline: none` without a replacement.
- Dropdowns / listboxes:
  - trigger: `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls={listId}`, `aria-activedescendant`
  - list: `role="listbox"` + `id={listId}`
  - item: `role="option"`, `aria-selected`, `aria-disabled={isDisabled || undefined}`
- Dialogs: `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`, `tabIndex={-1}`. Move focus into the dialog on open; return focus to the trigger on close.
- Sortable table headers: `aria-sort={col.sortDir ?? 'none'}`.
- Icons: decorative → `aria-hidden={true}`; standalone → `aria-label="…"`.
- Live regions: polite status → `role="status" aria-live="polite"`; urgent → `role="alert" aria-live="assertive"`.

#### State patterns

- Field-level loading: render `<Skeleton />`, not `<Spinner />`. `<Spinner />` is for overlay / full-component loading.
- Error state: `<div id={errorId} className="invalid-feedback d-block">{error}</div>`.
- Open/closed (dropdowns, modals): `useState(false)` + `useClickOutside(containerRef, () => setOpen(false))` + `Escape` key handler.

#### Animation

- Micro-interactions (color, border, opacity): `transition: {prop} 0.15s ease`.
- Layout transitions (height, width, transform): `transition: {prop} 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
- Enter animations: `@keyframes` with `animation: name 0.15s ease-out`.
- Always include `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`.

#### Z-index layers (don't invent new values)

| Layer | Value |
|-------|-------|
| Tooltip | 1070 |
| Dropdown list | 1060 |
| Modal content | 1055 |
| Modal backdrop | 1050 |
| Overlay (mobile sidebar) | 1000 |
| Sticky header | 1 |

#### Definition of done for a new component

1. `.tsx` exports component + prop interface(s), root has `component component-{name}` classes.
2. `_component-name.scss` added to `style/components/index.scss`.
3. Export added to `src/index.ts`.
4. IDs via `useId()`; labels wired via `htmlFor`; `:focus-visible` styles exist; keyboard nav (Tab, Enter/Space, Escape, arrows) works; ARIA is correct.
5. `loading` renders `<Skeleton />`; `error` renders with `aria-describedby`.
6. Responsive at 375 / 576 / 768 / 992 px; touch targets ≥44px on `pointer: coarse`; `prefers-reduced-motion` overrides animations.
7. `SKILL.md` updated — add to the correct Table of Contents category, add a `### ComponentName` section with a one-line description, a props table (✅ required / ❌ optional), and a minimal `tsx` example.
8. Demo at `examples/src/react-components/{ComponentName}Demo.tsx`, registered in `examples/src/react-components/index.tsx` under the correct category with a `{ key, category, element }` entry. Demos use Bootstrap grid (`container`, `row`, `col-lg-8`), wrap each variant group in a `<Card>` with an `<h2 className="h5 mb-3">`, show every meaningful prop variant, and end with a `<CodeSnippet>` card showing minimal usage.

### Examples app

`examples/` consumes the other packages via workspace wildcards (`"@toolcase/base": "*"`). It depends on built output where a package's `exports` map points, so after changing a package run its `build` (or `dev`) before expecting the example app to pick up changes. The deploy workflow runs `npm run build` at the root, which builds all packages before `vite build`.

### ESLint / TS config

- Single root `eslint.config.js` (flat config) applies to everything; `**/lib/` and `**/node_modules/` are ignored. `@typescript-eslint/no-explicit-any` is off; unused-vars allows `_`-prefix.
- Single root `tsconfig.json` with `jsx: "react"`, `strict`, `moduleResolution: "bundler"`. Per-package tsconfigs exist but inherit the root shape — prefer editing the root for global changes.
- Prettier: no semicolons, single quotes, trailing commas all, 4-space indent, 100 col.
