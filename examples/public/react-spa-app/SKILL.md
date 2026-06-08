---
name: react-spa-app
description: Use when scaffolding or extending a React + TypeScript SPA. Defines folder layout, path aliases, layering rules (pages → modules → components/services/state), zustand slice convention, react-router + AuthGuard wiring, modal registry, layout HOC, and singleton service pattern. Apply when adding a page, module, service, state slice, modal, or new SPA workspace. For static marketing/content sites with no auth or store (landing pages, docs, legal pages, prerendered/SEO marketing surfaces), use the next-static-app skill instead.
---

# react-spa-app — Architecture Reference

Opinionated blueprint for React SPAs. Layered, alias-routed, zustand-backed. Every new workspace and every new feature follows this layout. Deviation = bug.

Stack baseline:

- Vite + React (18+) + TypeScript (`strict`, `react-jsx`).
- `react-router` v7 (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useNavigate`, `useParams`, `useLocation`, `useSearchParams`).
- `zustand` v5 + `devtools` middleware. One store, many slices.
- A UI primitives library (e.g. `@toolcase/react-components`) providing `Modal`, `DashboardLayout`/`BasicLayout`, `FormInput`, `Button`, `Card`, `SideNav`, `Dropdown`, `Alert`, `TabSections`, etc. The architecture is independent of the specific library — swap freely.
- SCSS for styling (any CSS preprocessor works; rules below assume SCSS modules layered under `styles/`).
- ESM (`"type": "module"`).

---

## Optional @toolcase Libraries

These packages are designed for this SPA architecture. All are optional — use what fits.

- **`@toolcase/react-components`** — 180+ UI primitives covering typography, inputs, buttons, layout (`DashboardLayout`, `BasicLayout`), navigation (`SideNav`, `TabSections`), overlays (`Modal`, `Alert`, `Dropdown`), data display, charts, and marketing/landing surfaces. See the `react-components` skill for component catalog and usage.

- **`@toolcase/base`** — Zero-dep helpers and data structures: `Cache`, `PriorityQueue`, `VectorClock`, `ObjectPool`, `EventEmitter`, `Broadcast`, `generateId`, `retry`, `Color`, `JSONSchema`, `LSystem`, `WeightedRandom`, `Dijkstra`/`AStar`, `AdjacencyMatrix`, `State`, plus `HTTP` REST primitives (`Status`, `RESTError`, `RESTResponse`) and `Packing` (image atlas packer). Drop into `helpers/` or `services/`. See the `base` skill.

- **`@toolcase/logging`** — Isomorphic logger with named scopes, level filtering (`silent/error/warning/info/debug/verbose`), and pluggable `LogReporter` sinks (`ConsoleLogReporter` default; `JSONLineReporter`, `BufferedReporter` available). Wire once in `Init`, use named loggers per domain (`logging.getLogger('auth')`). See the `logging` skill.

- **`@toolcase/serializer`** — Runtime-defined protobuf schemas (`new Serializer()` + `wire.define(key, [{ key, type, rule }])`) with encode/decode to compact `Uint8Array` via `protobufjs/light`. No `.proto` build step. Useful for WebSocket or binary IPC wire format. Lives in `helpers/` or `services/`. See the `serializer` skill.

---

## Workspace Layout

```
<app>/
├── index.html
├── package.json          # "type": "module"
├── tsconfig.json         # paths match vite alias dirs
├── vite.config.ts        # auto-aliases src dirs
├── vite-env.d.ts
└── src/
    ├── main.tsx          # createRoot + global CSS imports + <Router />
    ├── Router.tsx        # BrowserRouter + Modal.ModalContext + Init + PageProvider + Routes + ModalRender
    ├── components/       # dumb visual components — props-only, no zustand, no service calls
    ├── configs/          # static config (env, featureFlags, lookup tables, providers)
    ├── contexts/         # React contexts (PageContext is mandatory)
    ├── helpers/          # pure utilities (storage, networkThrottle, format, apiClient, ...)
    ├── hooks/            # cross-page hooks (useAuth, ...)
    ├── layouts/          # BaseLayout + MainLayout (with wrapInXLayout HOC)
    ├── modals/           # modal containers + index.tsx exporting MODAL keys + ModalRender
    ├── modules/          # business-logic React components (zustand readers, service callers)
    ├── pages/            # one file per route — composes modules, sets page title, AuthGuard
    ├── services/         # singleton classes (getInstance()) — API/storage gateways
    ├── state/            # zustand slices (xxx.slice.ts) + index.ts aggregator
    ├── styles/           # SCSS: app.scss + components/ + modules/ + _grid.scss
    └── types/            # TS types per domain + index.ts barrel
```

Each top-level src dir is single-purpose. Adding a folder outside this set requires explicit justification.

---

## Path Aliases

`vite.config.ts` and `tsconfig.json` MUST stay in sync. Vite generates aliases from a list:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const srcDirs = [
    'components', 'configs', 'contexts', 'helpers', 'hooks',
    'layouts', 'modals', 'modules', 'pages', 'services',
    'state', 'styles', 'types',
]

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: srcDirs.map((dir) => ({
            find: new RegExp(`^${dir}(/|$)`),
            replacement: path.resolve(__dirname, `src/${dir}`) + '/',
        })),
    },
    css: { preprocessorOptions: { scss: {} } },
    server: { port: <unique-per-app> },
    build: {
        outDir: 'build',
        rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules')) return 'vendor' } } },
    },
})
```

`tsconfig.json` paths mirror it:

```json
"paths": {
    "components/*": ["./src/components/*"],
    "configs/*":    ["./src/configs/*"],
    "contexts/*":   ["./src/contexts/*"],
    "helpers/*":    ["./src/helpers/*"],
    "hooks/*":      ["./src/hooks/*"],
    "layouts/*":    ["./src/layouts/*"],
    "modals":       ["./src/modals/index.tsx"],
    "modals/*":     ["./src/modals/*"],
    "modules/*":    ["./src/modules/*"],
    "pages/*":      ["./src/pages/*"],
    "services/*":   ["./src/services/*"],
    "state":        ["./src/state/index.ts"],
    "state/*":      ["./src/state/*"],
    "styles/*":     ["./src/styles/*"],
    "types":        ["./src/types/index.ts"],
    "types/*":      ["./src/types/*"]
}
```

`state`, `types`, `modals` resolve to their `index` — always import `from 'state'`, `from 'types'`, `from 'modals'`. Never `from '../state'` or `from './modules/Foo'` — always alias-relative.

Note: the two mechanisms are not literally identical strings. The Vite alias maps a bare specifier to the `src/<dir>/` **directory** and relies on Vite's index resolution to pick up `index.ts`/`index.tsx`, whereas the tsconfig `paths` for `state`/`types`/`modals` hardcode the full `.../index.ts(x)` file. "MUST stay in sync" means the two must agree on the resolved target, not that the replacement strings match character-for-character.

---

## Boot Sequence

`main.tsx` — single render entry. Side-effect imports first (CSS, JS bundles), then router:

```tsx
import { createRoot } from 'react-dom/client'
import 'your-ui-library/style.css'
import './styles/app.scss'
import { Router } from './Router'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing in index.html')
createRoot(container).render(<Router />)
```

`Router.tsx` — fixed shell. Order matters:

```tsx
import { Routes, Route, BrowserRouter, Navigate } from 'react-router'
import { Modal } from 'your-ui-library'
import { ModalRender } from 'modals'
import { PageProvider } from 'contexts/PageContext'
import Init from 'modules/Init'
// import pages...

export const Router = () => (
    <Modal.ModalContext>
        <BrowserRouter>
            <Init />
            <PageProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    {/* ...routes */}
                    <Route path="*" element={<Navigate to="/<default>" replace />} />
                </Routes>
            </PageProvider>
            <ModalRender />
        </BrowserRouter>
    </Modal.ModalContext>
)
```

Constraints:

- `Modal.ModalContext` wraps `BrowserRouter`. `ModalRender` is a sibling of `Routes`, inside `BrowserRouter`.
- `Init` runs **before** `PageProvider` so hydration starts immediately on mount.
- Catch-all `*` always redirects to a sane default.
- Feature-flag routes inline: `{featureFlags.foo && <Route ... />}`.
- Tab routes use optional segment: `/users/:userId/:tab?`.

---

## Folder Contracts

### pages/

One file per route. **Composition only — NO business logic, NO direct service calls, NO complex state derivations.** A page must:

1. Wrap in `AuthGuard` (with `secured` prop when login required).
2. Set page title/description via `usePageContext()` in a `useEffect(() => {...}, [])`.
3. Render an outer container (e.g. `<section className="container"><div className="row"><div className="col-12">…`).
4. Drop one or more `<XxxModule />` components inside.
5. `export default wrapInMainLayout(PageComponent)` (or `wrapInBaseLayout` for unauthenticated/landing).

Canonical page:

```tsx
import React, { useEffect } from 'react'
import { wrapInMainLayout } from 'layouts/MainLayout'
import { usePageContext } from 'contexts/PageContext'
import AuthGuard from 'modules/AuthGuard'
import FooModule from 'modules/FooModule'

const FooPage: React.FC = () => {
    const { setPageTitle, setPageDescription } = usePageContext()

    useEffect(() => {
        setPageTitle('Foo')
        setPageDescription('Manage foos')
    }, [])

    return (
        <AuthGuard secured>
            <section className="container">
                <div className="row">
                    <div className="col-12">
                        <FooModule />
                    </div>
                </div>
            </section>
        </AuthGuard>
    )
}

export default wrapInMainLayout(FooPage)
```

Tab pages read `useParams().tab` and pass it to a `TabSections`/tabs component; navigation calls `navigate('/path/' + key)`.

Login-style pages skip the layout wrapper and render the login module inside an unsecured `AuthGuard`.

### modules/

The business-logic layer. Modules:

- Read store via many narrow selectors: `useStore(state => state.field)` per field (one call each — never destructure the whole state).
- Trigger store actions: `const updateX = useStore(s => s.updateX)`.
- Call services only **indirectly** through store actions (services live behind slices). Direct `Service.getInstance()` calls happen only from `Init`, `useAuth`, or other modules that intentionally bypass the store (rare — auth logout, redirects).
- Compose primitives from the UI library and dumb `components/`.
- Open modals via `Modal.useModalOpen(MODAL.X, payload => ...)`.
- Use `usePageContext()` to read title/description/accent.
- Are PascalCase, default export.

A module is "the implementation of one feature on a page". Examples: `LoginModule`, `ProjectStats`, `EditProfile`, `SidebarMenu`, `AlertPanel`, `UserDirectory`, `Init` (boot), `AuthGuard` (route gate), `PageHeader`, `<App>Brand` wrapper.

Module example:

```tsx
import { useStore } from 'state'
import { Card } from 'your-ui-library'

const FooModule: React.FC = () => {
    const items = useStore(state => state.foos)
    const fetchFoos = useStore(state => state.fetchFoos)
    const loading = useStore(state => state.foosLoading)
    // ... derived values, handlers, JSX
    return <Card>{/* ... */}</Card>
}

export default FooModule
```

Special modules every app has:

- `Init.tsx` — orchestrates first-load fetches gated by `useAuth().isAuthenticated` and store flags. Returns a `<Loading>` element while bootstrapping, `null` once ready.
- `AuthGuard.tsx` — checks auth + completion state, redirects via `<Navigate>` for `secured` prop, hands login token from URL to `useAuth().login()`.
- `<App>Brand.tsx` — wraps the brand primitive with app-specific text/logo.
- `PageHeader.tsx` — pulls `pageTitle`/`pageDescription` from `PageContext`.
- `SidebarMenu.tsx` — defines the menu sections, handles top-of-sidebar dropdown if applicable.
- `AlertPanel.tsx` — renders `state.alerts` via `<Alert>`, calls `dismissAlert`.
- `<User|Admin>Profile.tsx` — user-panel widget for the layout sidebar bottom.

### components/

Dumb visual components. **Never** import `state`, `services`, `hooks/useAuth`, `modals`. **Always** props-driven. They may use `useState`/`useMemo`/local refs and the UI library. They’re the place for forms, wizards, lists, presentational widgets that a module composes:

- `Loading.tsx` (boot screen)
- `XxxForm.tsx`, `XxxList.tsx` — form/list pieces consumed by modals or modules
- `XxxWizard.tsx` — multi-step wizard configurations

If a “component” needs the store, it’s actually a module — move it.

### layouts/

Two layouts, both expose a `wrapInXLayout(Component)` HOC. The HOC returns a function component that nests the page inside the layout:

```tsx
// MainLayout.tsx
import { DashboardLayout } from 'your-ui-library'
import SidebarMenu from 'modules/SidebarMenu'
import AppBrand from 'modules/AppBrand'
import UserProfile from 'modules/UserProfile'
import PageHeader from 'modules/PageHeader'
import AlertPanel from 'modules/AlertPanel'

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <DashboardLayout
        brandComponent={<AppBrand />}
        navbarLeftComponent={<PageHeader />}
        navbarRightComponent={null}        // app-specific (usage summary, search, etc.)
        sidebarMenuComponent={<SidebarMenu />}
        sidebarPanelComponent={<UserProfile />}
    >
        <AlertPanel />
        {children}
    </DashboardLayout>
)

export const wrapInMainLayout = (Component: React.FC) => {
    function WrappedWithMainLayout(props: any) {
        return <MainLayout><Component {...props} /></MainLayout>
    }
    WrappedWithMainLayout.displayName = `MainLayout(${Component.displayName || Component.name || 'Component'})`
    return WrappedWithMainLayout
}

export default MainLayout
```

`BaseLayout` wraps a minimal `BasicLayout`/shell — used for unauthenticated/landing pages. Never use a layout directly inside JSX of a page; always go through the HOC export. Layouts are **the only allowed visual components in pages besides modules** (and only via HOC).

### state/

One zustand store, many slices. Fixed structure:

```ts
// state/index.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createFooSlice, FooSlice } from './foos.slice'
import { createBarSlice, BarSlice } from './bars.slice'

export type AppStore = FooSlice & BarSlice

export const useStore = create<AppStore>()(
    devtools(
        (...args) => ({
            ...createFooSlice(...args),
            ...createBarSlice(...args),
        }),
        { name: 'store' }
    )
)
```

Every domain gets its own `<domain>.slice.ts`:

```ts
import { StateCreator } from 'zustand'
import type { AppStore } from './index'
import FooService from 'services/FooService'
import { Foo } from 'types'

export type FooSlice = {
    foos: Foo[]
    foosLoading: boolean
    fetchFoos: () => Promise<void>
    createFoo: (foo: Foo) => Promise<void>
    updateFoo: (id: string, data: Partial<Foo>) => Promise<void>
    deleteFoo: (id: string) => Promise<void>
}

export const createFooSlice: StateCreator<AppStore, [], [], FooSlice> = (set, get) => ({
    foos: [],
    foosLoading: false,

    async fetchFoos() {
        set({ foosLoading: true })
        try {
            const foos = await FooService.getInstance().fetch()
            set({ foos })
        } finally {
            set({ foosLoading: false })
        }
    },

    async createFoo(foo) {
        await FooService.getInstance().create(foo)
        get().fetchFoos()
    },

    async updateFoo(id, data) {
        await FooService.getInstance().update(id, data)
        get().fetchFoos()
    },

    async deleteFoo(id) {
        await FooService.getInstance().delete(id)
        get().fetchFoos()
    },
})
```

Conventions:

- Slice file naming: `<domain>.slice.ts`, lowercase, plural where natural.
- Slice exports: `type XxxSlice` + `createXxxSlice: StateCreator<AppStore, [], [], XxxSlice>`.
- State fields and actions live in the same slice. No separate “store/actions” split.
- Action pattern: call `Service.getInstance().method()`, then `set(...)` or call another action via `get().refetchX()`.
- Slices may cross-call: a fetch action can `get().addAlert(...)` to push a banner — that’s the only legitimate cross-slice coupling. Don’t reach into another slice’s service from here.
- `alerts.slice.ts` is mandatory (used by `AlertPanel` + the API-client toast hook).
- Loading flags follow `<domain>Loading` naming. Avoid global `loading` flag.
- Selectors at call site: one `useStore(s => s.field)` per field. Never `useStore(s => s)` or destructure.

### services/

Singleton classes. Each domain gets `<Domain>Service.ts`:

```ts
import { networkThrottle } from 'helpers/networkThrottle'
import { readFromStorage, writeToStorage } from 'helpers/storage'
import { Foo } from 'types'

class FooService {
    private static instance: FooService
    private constructor() {}

    static getInstance(): FooService {
        if (!FooService.instance) FooService.instance = new FooService()
        return FooService.instance
    }

    async fetch(): Promise<Foo[]> {
        await networkThrottle(300)
        return readFromStorage<Foo[]>('foos', [])
        // TODO: replace with apiClient call when backend ready
    }

    async create(foo: Foo): Promise<void> { /* ... */ }
    async update(id: string, data: Partial<Foo>): Promise<void> { /* ... */ }
    async delete(id: string): Promise<void> { /* ... */ }
}

export default FooService
```

Rules:

- `private static instance` + `private constructor()` + `static getInstance()`. Default export the class.
- All public methods async. Use `networkThrottle(ms)` to simulate latency in mock mode (200–400 ms typical).
- Persist mock data via `helpers/storage` (namespaced localStorage).
- Real APIs go through `helpers/apiClient` (`api.get/post/put/patch/delete`) which handles JWT, refresh, request id, `ApiError`. Wire `registerUnauthorizedHandler` and `registerToastHandler` once in `Init`.
- `AuthService` is special: handles JWT read/write, provider redirect, login token, logout (`window.location.reload()` to reset SPA state).
- A service NEVER imports zustand or React. Pure logic + I/O.
- Place mock fixtures under `services/mocks/` if dataset is large enough to warrant a separate file.

### modals/

Registry pattern. Two files minimum: `index.tsx` (registry) and one container per modal.

```tsx
// modals/index.tsx
import { Modal } from 'your-ui-library'
import CreateFooModal from './CreateFooModal'
import ConfirmFooModal from './ConfirmFooModal'

export const MODAL = {
    CREATE_FOO: 'create-foo',
    CONFIRM_FOO: 'confirm-foo',
}

export const ModalRender = () => (
    <Modal.ModalRender>
        <Modal.Window size="large" key={MODAL.CREATE_FOO}>
            <CreateFooModal />
        </Modal.Window>
        <Modal.Window size="medium" key={MODAL.CONFIRM_FOO}>
            <ConfirmFooModal />
        </Modal.Window>
    </Modal.ModalRender>
)
```

Container modal:

```tsx
import { Modal } from 'your-ui-library'
import { CreateFooForm, FooConfig } from 'components/CreateFooForm'

const CreateFooModal: React.FC = () => {
    const closeModal = Modal.useModalClose()
    return <CreateFooForm onComplete={(c: FooConfig) => closeModal(c)} />
}

export default CreateFooModal
```

Open from a module:

```ts
const openCreateFoo = Modal.useModalOpen<FooConfig | null>(MODAL.CREATE_FOO, (payload) => {
    if (payload) createFoo(payload)
})
// later: openCreateFoo()
```

Conventions:

- `MODAL` keys are kebab-case strings; constants are SCREAMING_SNAKE_CASE.
- Window sizes: `'small' | 'medium' | 'large' | 'xlarge'` (or whatever the UI lib supports).
- Container files render only forms/wizards from `components/` plus `useModalClose` glue. Never embed business logic in the container — push it to the form (props in, callback out).
- Either inline the `MODAL` object in `modals/index.tsx` or split into `modals/keys.ts` and re-export. Pick one per app and stick with it.

### contexts/

Reserved for cross-cutting React contexts. **`PageContext` is mandatory.** It carries `pageTitle`, `pageDescription`, and an accent `color` (always present — defaults to `'#000000'`). Every page sets it; `PageHeader` reads it.

```tsx
export const PageContext = createContext({
    pageTitle: '', pageDescription: '', color: '#000000',
    setPageTitle: (_: string) => {},
    setPageDescription: (_: string) => {},
    setColor: (_: string) => {},
})

export const PageProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pageTitle, setPageTitle] = useState('<APP NAME>')
    const [pageDescription, setPageDescription] = useState('')
    const [color, setColor] = useState('#000000')
    return (
        <PageContext.Provider value={{ pageTitle, pageDescription, color, setPageTitle, setPageDescription, setColor }}>
            {children}
        </PageContext.Provider>
    )
}

export const usePageContext = () => useContext(PageContext)
```

Add other contexts only when zustand or props-drilling don't fit (rare).

### hooks/

Cross-cutting hooks. `useAuth` is mandatory and is the only consumer of `AuthService` from React land:

```ts
const useAuth = () => {
    const jwt = AuthService.getInstance().getJWT()
    const [searchParams] = useSearchParams()
    const [isAuthenticated] = useState(!!jwt)

    return {
        isAuthenticated,
        getLoginToken: () => searchParams.get(AuthService.loginTokenQueryParam),
        login: (token: string) => AuthService.getInstance().login(token).then(() => {
            const url = new URL(window.location.href)
            url.searchParams.delete(AuthService.loginTokenQueryParam)
            window.history.replaceState({}, '', url.toString())
            window.location.reload()
        }),
        handleProviderLogin: (provider: string) => AuthService.getInstance().redirectForProviderLogin(provider),
    }
}
```

The `window.location.reload()` after `login()` exists because `useAuth` reads the JWT once into `useState` (`isAuthenticated` is initialized from `!!jwt` and never recomputed). Once `AuthService` writes the new token, React state is stale, so a full page reload is the simplest way to re-derive `isAuthenticated` from the freshly persisted JWT.

Other hooks: domain-specific composition (`usePayments`, `useFeatureFlag`, etc.). Keep small; lift state into zustand if it grows.

### helpers/

Pure utilities. Always isomorphic where possible. Conventions:

- `storage.ts` — namespaced localStorage (`<APP_PREFIX>:<key>`) with safe `read/write/remove` and JSON encode/decode.
- `networkThrottle.ts` — `setTimeout`-based delay (`networkThrottle(420)`) for mocked services.
- `apiClient.ts` — fetch wrapper with JWT auth, refresh-token flow, request-id header, `ApiError` class, `registerUnauthorizedHandler`, optional `registerToastHandler`. Default to JSON; pass `FormData` raw.
- `format.ts` — date/byte/currency formatters.
- `id.ts` — id generation.
- `<domain>.ts` — domain-specific pure helpers (e.g. `subscription.ts` for plan-name → variant lookups).

No React, no zustand, no DOM (except `window`/`localStorage` guarded).

### configs/

Static config + environment. Conventions:

- `env.ts` — read `import.meta.env.VITE_*` once, export typed constants with sensible localhost defaults.
- `featureFlags.ts` — truthy parser over `VITE_FEATURE_*`. `export const featureFlags = { ... }` and `export type FeatureFlag = keyof typeof featureFlags`.
- `<domain>.ts` — lookup tables (icons list, color palettes, login providers, country list). No logic beyond simple `find`/`map` helpers.

Configs are imported as `import * as project from 'configs/project'` or by named exports.

### types/

Domain types. One file per domain, `index.ts` re-exports everything:

```ts
// types/index.ts
export * from './foo'
export * from './bar'
```

Imports use the alias: `import { Foo } from 'types'`. Co-locate enum literals with their type.

### styles/

Stylesheet root. Structure:

```
styles/
├── app.scss              # entrypoint — @use components, modules, grid + global resets
├── _grid.scss            # grid utilities
├── components/           # one _xxx.scss per component, _index.scss barrel
└── modules/              # one _xxx.scss per module, _index.scss barrel
```

`app.scss` imports `components`, `modules`, `grid` plus global resets / typography. Component styles use BEM-ish prefixes (`component-loading__brand`). Module styles prefixed `module module-<name>` on the root element.

---

## Cross-Cutting Patterns

### Selector usage

Always one selector per field:

```ts
const items = useStore(s => s.items)
const loading = useStore(s => s.itemsLoading)
const fetchItems = useStore(s => s.fetchItems)
```

NOT `const { items, loading, fetchItems } = useStore()`. Forces re-renders.

### Auth guard placement

Every secured page MUST be wrapped in `<AuthGuard secured>` at the page level. Unsecured pages still wrap in `<AuthGuard>` (no `secured`) so the guard can redirect authenticated users away from `/login`. The guard handles three flows: token-from-URL hand-off, profile-completion redirect, login redirect.

### Init module orchestration

`Init` is rendered **inside** `BrowserRouter` and **before** `PageProvider`. It:

1. Registers global API hooks (`registerUnauthorizedHandler`, `registerToastHandler`) once.
2. Fetches user/account once authenticated.
3. Fetches app-wide reference data (constants, scopes, subscription) after the user is loaded.
4. Renders a full-screen `<Loading><AppBrand xlarge /></Loading>` while bootstrapping; returns `null` when done; returns `<></>` when unauthenticated.

### Page title / description

Mandatory in every page:

```tsx
useEffect(() => {
    setPageTitle('…')
    setPageDescription('…')
}, [])
```

For tab pages, depend on the active tab key.

### Modal payload typing

Use `Modal.useModalOpen<TPayload, TInput>(KEY, callback)` with explicit generics. Container uses `Modal.useModalClose()` and calls `closeModal(payload)`.

### Network/storage layering

```
module → store action → service.method() → apiClient | storage | networkThrottle
```

Skipping a layer is a smell. Modules don’t call services directly. Services don’t call store. Slices don’t call other slices’ services (cross-slice action call is OK).

### Alert flow

Use `state.addAlert({ key, variant, message, dismissible })`. The API client’s toast handler routes server errors here. `AlertPanel` renders them inside the container.

---

## Recipes

### Add a new page

1. Create `src/pages/FooPage.tsx` — AuthGuard + container/row/col + module + `wrapInMainLayout`.
2. Add `<Route path="/foo" element={<FooPage />} />` in `Router.tsx`.
3. If new feature has its own UI → create `src/modules/Foo.tsx`. Compose primitives + dumb components.
4. Add menu item to `modules/SidebarMenu.tsx` (right `key`, the `onItemClick` already navigates by key).

### Add a new domain (CRUD slice + service + types)

1. `types/foo.ts` — `export type Foo = { … }`. Add `export * from './foo'` to `types/index.ts`.
2. `services/FooService.ts` — singleton with `fetch / create / update / delete`. Use `networkThrottle` + `helpers/storage` for mocks, or `helpers/apiClient` for real API.
3. `state/foo.slice.ts` — `FooSlice` type + `createFooSlice`. Mirror the service surface; loading flag named `foosLoading`.
4. `state/index.ts` — intersect into `AppStore`, spread into `useStore`.
5. Bootstrap fetch in `modules/Init.tsx` if data is needed app-wide; otherwise let the consuming page/module call `fetchFoos()` in a `useEffect`.

### Add a new modal

1. `modals/CreateFooModal.tsx` — container, `Modal.useModalClose`, render the form from `components/`.
2. `modals/index.tsx` — add `MODAL.CREATE_FOO = 'create-foo'` and a `<Modal.Window size=… key={MODAL.CREATE_FOO}>` entry.
3. Open from a module via `Modal.useModalOpen(MODAL.CREATE_FOO, payload => …)`.
4. If the form is reusable → put it in `components/CreateFooForm.tsx`. If it’s one-off → still put it there (forms are dumb visual). Only the wiring lives in the modal container.

### Add a wizard / form

Build the wizard component in `components/` using a `FormWizard` + steps array. Accept config + callbacks via props. Reference data (icons, colors, recommended tags) flows in via props from the modal/module — components never read store.

### Add a feature-flagged page

```ts
// configs/featureFlags.ts
export const featureFlags = {
    foo: truthy(import.meta.env.VITE_FEATURE_FOO),
}
```

```tsx
// Router.tsx
{featureFlags.foo && <Route path="/foo" element={<FooPage />} />}

// SidebarMenu menu definition
...(featureFlags.foo ? [{ key: 'foo', label: 'Foo', icon: 'star' }] : []),
```

### Scaffold a new SPA workspace

Create `<app>/` with:

- `package.json` (`"type": "module"`, scripts `dev/build/preview/typecheck`, deps: `react`, `react-dom`, `react-router`, `zustand`, your UI library).
- `index.html` (one `<div id="root">`).
- `vite.config.ts` (alias generator + assigned port).
- `tsconfig.json` (paths matching the alias list).
- `vite-env.d.ts` (Vite types).
- `src/main.tsx`, `src/Router.tsx`.
- All thirteen src dirs created up front, each with a placeholder file (`AppBrand.tsx`, `Init.tsx`, `AuthGuard.tsx`, `PageContext.tsx`, `useAuth.ts`, `AuthService.ts`, `storage.ts`, `networkThrottle.ts`, `alerts.slice.ts`, `user.slice.ts`, `state/index.ts`, `modals/index.tsx`, `layouts/MainLayout.tsx`, `layouts/BaseLayout.tsx`, `pages/LoginPage.tsx`, `styles/app.scss` with `_index.scss` barrels).
- Pick a unique dev port and a unique storage prefix in `helpers/storage.ts`.

---

## Anti-Patterns

- ❌ Page directly importing `useStore`. → Move logic into a module; the page only composes.
- ❌ Component importing `state` or `services`. → Promote it to a module, or pass data/callbacks via props.
- ❌ Module instantiating `new XxxService()` instead of `XxxService.getInstance()`.
- ❌ Single mega-slice. Split per domain.
- ❌ Multiple zustand stores. There is one `useStore`.
- ❌ `useStore()` without selector (returns whole state).
- ❌ Direct `fetch()` from a service. Always go through `apiClient` (real) or `networkThrottle + storage` (mock).
- ❌ Modal logic inside the page. Pages don’t open modals — modules do.
- ❌ Layout JSX inside a page (`<MainLayout><Page/></MainLayout>`). Use the HOC.
- ❌ `import { Foo } from '../../types/foo'`. Use the alias: `import { Foo } from 'types'`.
- ❌ Mixing styling systems. Pick one (SCSS layered through `styles/`, or a single CSS-in-JS lib) and stick with it.
- ❌ React Query / SWR / Redux on top of this stack. zustand + service singletons cover this layering.
- ❌ Storing JWT in zustand. JWT lives in `localStorage` via `AuthService`/`apiClient`; React derives `isAuthenticated` from it.
- ❌ Adding a new top-level `src/` folder. Justify in PR; otherwise it goes inside one of the thirteen.
