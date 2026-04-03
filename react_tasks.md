# React Components — Tasks

## Analysis Summary

- **Package:** `@toolcase/react-components` (private, v1.0.0)
- **Components:** 81 named exports + Modal namespace (87 source files)
- **Styling:** Bootstrap 5 + custom SCSS (compiled to single `lib/index.css`)
- **Build:** Manual shell script (`scripts/build-silent.sh`) — runs `tsc` + `sass` CLI
- **Demo:** Standalone HTML/TSX app using React Router, Bootstrap, no bundler config
- **Entry:** `lib/index.js` (ESM output from tsc), `lib/index.d.ts` (types)
- **Pattern:** Functional components, CSS class-based styling (Bootstrap-aligned), HTML attribute spreading

## Known Issues

### 1. Build Process — Implement proper component library build

**Current state:**
- No `tsconfig.json` in react-components (should follow `base/` pattern with `outDir: ./lib`, `rootDir: ./src`)
- No `tsup.config.js` — other workspace packages (base, logging, serializer) use tsup for bundling
- `package.json` has zero scripts defined (no `build`, `dev`, `test`, `lint`)
- Build is a manual shell script (`scripts/build-silent.sh`) that calls `npx tsc` and `npx sass`
- No `exports` field in package.json (only `main` and `types`)
- react-components is **not listed** in root `package.json` workspaces array

**Tasks:**
- [x] Add `react-components` to root `package.json` workspaces array
- [x] Create `react-components/tsconfig.json` extending root config (match base/ pattern)
- [x] Create `react-components/tsup.config.js` with ESM + CJS output, external React/ReactDOM
- [x] Add `build`, `dev`, `lint` scripts to `react-components/package.json`
- [x] Add `exports` field to package.json for proper ESM/CJS resolution
- [x] Add `react` and `react-dom` as peerDependencies
- [x] Integrate SCSS compilation into the build pipeline (tsup plugin or separate script)
- [x] Ensure `lib/index.css` is generated as part of build
- [ ] Remove or replace `scripts/build-silent.sh` once proper build is in place
- [x] Verify TypeScript declarations are emitted correctly

### 2. Merge demo into @toolcase/examples

**Current state:**
- `react-components/demo/` is a standalone app (React 18, React Router, Bootstrap)
- `examples/` is a separate workspace using Parcel, non-React, loads examples via query params
- Demo title says `@webgame-cloud/react-components` (stale name)
- Demo has its own `main.tsx`, `style.css`, `index.html`, and `examples/` directory with 60+ component examples

**Tasks:**
- [x] Redesign `@toolcase/examples` as a unified web presentation of the whole `@toolcase` project
- [x] Migrate react-components demo content (`demo/main.tsx`, `demo/examples/`, `demo/style.css`) into `@toolcase/examples`
- [x] Create navigation/routing that covers all packages: base, logging, serializer, react-components
- [ ] Remove `react-components/demo/` after migration
- [x] Update `examples/package.json` dependencies to include React, React Router, Bootstrap
- [x] Replace or upgrade Parcel bundler if needed (consider Vite for React support)
- [x] Ensure existing non-React examples (State, Serializer, AdjMatrix, etc.) are preserved

### 3. Publish @toolcase/examples to GitHub Pages

**Current state:**
- `examples/` build script is `echo "not implemented"`
- No GitHub Actions or deployment workflow exists
- No `public` branch configured for GH Pages

**Tasks:**
- [x] Implement production build in `@toolcase/examples` (`build` script → outputs to `dist/`)
- [x] Create GitHub Actions workflow for building and deploying to `public` branch
- [x] Configure GH Pages to serve from `public` branch (root)
- [x] Ensure all assets (CSS, JS, images) are properly bundled with correct base paths
- [x] Add `homepage` field to `examples/package.json` if needed for asset paths
- [ ] Test the full build → deploy pipeline

## Additional Issues Found

- [x] **React/ReactDOM not in peerDependencies** — added `react>=18` and `react-dom>=18` as peer deps
- [ ] **No test suite** — react-components has no tests (other packages have vitest tests)
- [x] **Stale references** — fixed demo title to `@toolcase/react-components`
- [ ] **Bootstrap tight coupling** — components use Bootstrap CSS classes directly; consider if this should be documented as a peer dependency or bundled
- [ ] **No component documentation** — README is a structural overview, not usage docs
