---
name: next-static-app
description: Use when scaffolding or extending a statically-prerendered React Router v7 marketing/content site (landing page, docs, legal pages). Defines workspace layout (app/ + routes/ + modules/), file-based routing through routes.ts, prerender + SPA hydration config, root.tsx shell with Layout/App/ErrorBoundary, per-route meta() for SEO, modules/ section composition pattern, Tailwind v4 + @toolcase/react-components stack, public/ assets (sitemap, robots, og), and the nginx-served Docker build. Apply when adding a route, marketing section, legal page, SEO metadata, env var, sitemap entry, or scaffolding a new static-app workspace.
---

# next-static-app — Architecture Reference

Opinionated blueprint for statically-prerendered marketing & content sites. React Router v7 in SPA + prerender mode, served as plain HTML by nginx. No SSR runtime, no API layer, no auth, no client store. Composition-only: routes pull modules in, modules render UI primitives. Deviation = bug.

Despite the skill name, the runtime is **React Router v7** (not Next.js). "next-static-app" = "next-gen static app". If you need server runtime, dynamic routes, or auth — use the `react-spa-app` skill instead.

Stack baseline:

- Vite + React 19 + TypeScript (`strict`, `react-jsx`).
- `react-router` v7 with `@react-router/dev` Vite plugin + `@react-router/node` types. Routes declared in `app/routes.ts` via `index()` / `route()` helpers.
- `react-router.config.ts` with `prerender: true, ssr: false` — every route is rendered to static HTML at build time, then hydrated as an SPA.
- Tailwind v4 (`@import 'tailwindcss'`) + `@toolcase/react-components` for primitives + `bootstrap-icons` font + Bootstrap utility classes mixed in. The architecture is library-independent — swap freely, but pick **one** UI primitives library per app.
- ESM (`"type": "module"`).
- Node 24+ (`engines.node: ">=24"`).
- Dockerfile: `npm run build` → `build/client/` → copied into nginx:alpine.

---

## Optional @toolcase Libraries

- **`@toolcase/react-components`** — primary UI primitives (`Hero`, `CoolNav`, `CoolButton`, `Brand`, `Icon`, `PageFooter`, `PricingCard`, `FeatureCard`, `PinnedFeatureShowcase`, `EarlySignupForm`, `Heading`, `Text`, `SectionCard`, etc.). See `react-components` skill for catalog.
- **`@toolcase/base`** — pure helpers/data structures if a section needs them. No store/services in this stack, so usage is rare.
- **`@toolcase/logging`** — unnecessary. Static sites should not log to remote sinks at runtime. Use `console` directly.

`@toolcase/serializer`, `zustand`, `react-query`, `redux` — **out of scope**. If you reach for them, the project is no longer a static-app — switch to `react-spa-app`.

---

## Workspace Layout

```
<app>/
├── package.json              # "type": "module", scripts dev/build/preview/typecheck
├── tsconfig.json             # includes "app" + ".react-router/types/**/*"
├── vite.config.ts            # reactRouter() plugin + tsconfigPaths
├── react-router.config.ts    # prerender: true, ssr: false
├── Dockerfile                # multi-stage: node build → nginx static
├── .env / .env.example       # VITE_* only
├── .dockerignore
├── public/                   # static assets — copied verbatim to build/client
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml
│   └── imgs/
└── app/
    ├── root.tsx              # Layout (html shell) + App (Outlet + globals) + ErrorBoundary + links
    ├── routes.ts             # RouteConfig: index() + route(path, file)
    ├── app.css               # tailwind import + theme tokens + global resets
    ├── routes/               # one .tsx per route — meta() + default page composing modules
    └── modules/              # reusable section components consumed by routes
```

Top-level `app/` dirs are single-purpose. **No** `components/`, `services/`, `state/`, `hooks/`, `helpers/`, `types/` unless the project genuinely needs them — those signal escape from "static site" into SPA territory. If you do add one:

- `app/helpers/` — pure isomorphic utilities (no DOM unless guarded with `typeof window === 'undefined'`).
- `app/types/` — shared TS types with `index.ts` barrel.
- Avoid `services/` and `state/` in this stack. If you need them, you're in the wrong skill.

---

## Routing

`app/routes.ts` declares every route. File-based but explicit — no auto-magic from filenames:

```ts
import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
    index('routes/index.tsx'),
    route('terms', 'routes/terms.tsx'),
    route('privacy', 'routes/privacy.tsx'),
    route('dmca', 'routes/dmca.tsx'),
] satisfies RouteConfig
```

Rules:

- `index()` for `/`. `route(path, file)` for everything else. Path is **without** leading `/`.
- One route file per route. Filename matches path semantically (`terms.tsx`, not `TermsPage.tsx`).
- Adding a route = three edits: `routes.ts` entry, route file in `app/routes/`, sitemap.xml entry. Forgetting sitemap = SEO regression.
- Generated types live at `app/+types/<route>` — import as `import type { Route } from './+types/<name>'`. Do not commit `.react-router/types/`; `react-router typegen` regenerates on `dev`/`typecheck`.

For nested routes, use react-router's nested-route helpers (`route('parent', 'parent.tsx', [route('child', 'child.tsx')])`). Keep flat unless content nests.

---

## Prerender Config

`react-router.config.ts`:

```ts
import type { Config } from '@react-router/dev/config'

export default {
    prerender: true,    // emit static HTML for every route at build time
    ssr: false,         // no server runtime — pure SPA hydration
} satisfies Config
```

`prerender: true` + `ssr: false` is the contract:

- Every route in `routes.ts` produces a static `.html` file under `build/client/`.
- After hydration the page is a normal SPA — `Outlet`, `useNavigate`, etc. all work.
- **No** server-only code. `loader`/`action` exports run at **build time** only — treat them as static data fetchers, not runtime endpoints.
- Anything that depends on `window`/`document` MUST run inside `useEffect` or be guarded with `typeof window === 'undefined'`. Otherwise prerender crashes.
- Dynamic routes (`/post/:slug`) require `prerender: ['/post/a', '/post/b', ...]` — explicit list. Or move to a runtime renderer (different skill).

If a route legitimately needs SSR or dynamic data, the project doesn't fit this skill — migrate to `react-spa-app` (CSR-only) or to a server-rendered framework.

---

## Boot Sequence

`app/root.tsx` is the shell. Three exports + optional `links`:

```tsx
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import type { Route } from './+types/root'
import '@toolcase/react-components/style.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './app.css'

export const links: Route.LinksFunction = () => [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:...&display=swap' },
]

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#6366f1" />
                <Meta />
                <Links />
            </head>
            <body suppressHydrationWarning>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    )
}

export default function App() {
    return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = 'Oops!'
    let details = 'An unexpected error occurred.'
    let stack: string | undefined
    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? '404' : 'Error'
        details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details
    } else if (import.meta.env.DEV && error instanceof Error) {
        details = error.message
        stack = error.stack
    }
    return (
        <main className="pt-16 p-4 container mx-auto">
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && <pre className="w-full p-4 overflow-x-auto"><code>{stack}</code></pre>}
        </main>
    )
}
```

Constraints:

- `Layout` MUST render the full `<html>` tree — react-router needs `<Meta />`, `<Links />`, `<ScrollRestoration />`, `<Scripts />` in this order.
- `suppressHydrationWarning` on `<html>` and `<body>` — prerender + browser extensions inject DOM nodes; without this, hydration warnings spam the console.
- Side-effect CSS imports go at the top of `root.tsx` only. Order: vendor (UI lib) → icon font → app globals.
- `App()` is the cross-route shell. Wrap `<Outlet />` here for things every route needs (cookie banner, analytics injector, theme provider). Keep it thin — page-specific layout belongs in routes/modules.
- `ErrorBoundary` is mandatory. Show stack only in `import.meta.env.DEV`.

---

## Folder Contracts

### routes/

One `.tsx` per route. **Composition only — NO business logic, NO data fetching, NO direct DOM work outside `useEffect`.** A route file must:

1. Import `Route` types from `./+types/<name>`.
2. Export `meta({}: Route.MetaArgs)` returning the `<title>`, `<meta name="description">`, OG, Twitter card tags.
3. Export `default` page component composing modules.
4. Wrap content in a top-level `<div>` with the page background + min-height (`bg-white min-vh-100` or `... d-flex flex-column` for sticky-footer pages).
5. Compose `<Navbar />`, `<main>{...sections...}</main>`, `<Footer />` from `app/modules/`.

Canonical landing route:

```tsx
import type { Route } from './+types/index'
import { Navbar } from '../modules/Navbar'
import { PageHero } from '../modules/PageHero'
import { Features } from '../modules/Features'
import { Footer } from '../modules/Footer'

const SITE_URL = 'https://example.com'
const OG_IMAGE = `${SITE_URL}/imgs/og-cover.png`
const TITLE = 'Example — tagline'
const DESCRIPTION = 'One-sentence pitch under 160 chars.'

export function meta({}: Route.MetaArgs) {
    return [
        { title: TITLE },
        { name: 'description', content: DESCRIPTION },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: SITE_URL },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:image', content: OG_IMAGE },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: SITE_URL },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:description', content: DESCRIPTION },
        { name: 'twitter:image', content: OG_IMAGE },
    ]
}

export default function Home() {
    return (
        <div className="bg-white min-vh-100">
            <Navbar />
            <main>
                <PageHero />
                <Features />
            </main>
            <Footer />
        </div>
    )
}
```

Legal/content routes (Terms, Privacy, DMCA) follow the same skeleton with a sticky-footer wrapper:

```tsx
return (
    <div className="bg-white min-vh-100 d-flex flex-column">
        <Navbar />
        <main className="flex-grow-1">
            {/* hero strip + section list */}
        </main>
        <Footer />
    </div>
)
```

Rules:

- `meta()` is mandatory on every route. Title under 60 chars, description under 160. OG + Twitter pairs always included.
- Inline copy (legal text, hero copy) lives in the route file — not pushed to a CMS. Static = static.
- Constants (URLs, dates, brand strings) live at the top of the route file, SCREAMING_SNAKE_CASE.
- A route NEVER imports from `app/routes/` (no cross-route imports). Shared UI = a module.

### modules/

Reusable section components. Modules:

- Are PascalCase, **named export** (not default), one per file: `export const Navbar = () => ...`.
- Compose UI primitives from `@toolcase/react-components` (or whichever lib) with minimal wiring.
- May use `useState`/`useEffect`/`useRef` for local interactivity (cookie banner state, scroll-into-view, mounted flag).
- **Never** read from a store, fetch from network at runtime, or import other modules' internals. Sections are independent — composed by the route, not chained.
- Encapsulate their own data when it's static config (feature lists, plan tiers, sitemap-style menu definitions). Co-locate it at the top of the module file as `const items = [...]` / `const plans = [...]`.

Module skeleton:

```tsx
import { Hero } from '@toolcase/react-components'

export const PageHero: React.FC = () => {
    return (
        <Hero
            eyebrow="..."
            title="..."
            description="..."
            primaryAction={{ label: '...', onClick: () => scrollToId('early-access') }}
            secondaryAction={{ label: '...', onClick: () => scrollToId('features') }}
        />
    )
}
```

Special modules every static-app has:

- `Navbar.tsx` — top nav. Anchor links (`#section-id`) for in-page jumps; absolute paths for cross-route. CTA in `rightEl`.
- `Footer.tsx` — `PageFooter` with menus, social links, legal links (Terms/Privacy/DMCA), copyright.
- `Analytics.tsx` — gated GA4/segment loader. Mounts a `<script>` tag inside `useEffect` only when `enabled`. Returns `null`. SSR-safe — guards `typeof window === 'undefined'`.
- `CookieConsent.tsx` — banner + `useCookieConsent` hook. Reads/writes `localStorage` inside `useEffect` (NEVER during render — would crash prerender). Returns `null` until hydrated.
- Section modules per landing block: `PageHero`, `HowItWorks`, `Features`, `Pricing`, `EarlyAccess`. Each owns a `<section id="...">` with a stable id used by anchor links and the sitemap.

Cross-cutting helpers (anchor scroll, mailto handlers) live inline at the top of the module that uses them — **don't** create `helpers/scroll.ts` for two callers:

```ts
const scrollToId = (id: string) => {
    if (typeof document === 'undefined') return
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```

If three modules use the same scroll helper, **then** lift it to `app/helpers/scroll.ts`.

### public/

Static assets served verbatim from the site root. Conventions:

- `favicon.ico` — root favicon. Multi-resolution `.ico` preferred.
- `robots.txt` — `User-agent: *` + `Sitemap:` line pointing at the production sitemap URL.
- `sitemap.xml` — every route declared in `routes.ts` MUST appear here. `priority` 1.0 for index, 0.3 for legal, 0.5+ for marketing. `changefreq` `weekly` for landing, `monthly` for legal. Update timestamps when content materially changes.
- `imgs/` — OG covers (`og-cover.png`, 1200×630), hero patterns (SVG preferred), icon sets used by sections. Reference as `/imgs/...` (absolute root paths — not Vite-imported, since prerender expects raw URLs in HTML).
- Any other root-served file (`.well-known/`, `humans.txt`) goes here.

Public assets are NEVER imported from JS — they're referenced as string URLs. JS-imported assets go through Vite's regular asset pipeline from `app/`.

### app.css

Single global stylesheet. Order:

```css
@import 'tailwindcss';

@theme {
    /* design tokens — fonts, colors, spacing */
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif, ...;
}

html, body {
    @apply bg-white;
}

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
    }
}
```

Rules:

- One global CSS file. No per-module SCSS in this stack — Tailwind utilities + UI library styles cover it. If you need component-scoped styles, use Tailwind classes; if Tailwind isn't enough, you've outgrown this skill.
- `prefers-reduced-motion` reset is mandatory — required for accessibility audits.
- Theme tokens go in `@theme` (Tailwind v4 syntax). Don't shadow with `:root { --x }` unless you're integrating with non-Tailwind components.

---

## Cross-Cutting Patterns

### SEO

Every route exports `meta()`. Every route has a sitemap entry. Every route has a unique title and description. OG + Twitter cards on every route — share previews are non-negotiable.

`<meta name="theme-color">` lives in `root.tsx` Layout (one global value). Per-route theme-color requires escape hatches — not worth it.

### Anchor navigation

Cross-section links inside one page = anchor href (`#how-it-works`) + scroll-into-view handler. Cross-route links = absolute path (`/terms`). Never use `react-router`'s `<Link>` for anchor jumps — anchors don't trigger SPA navigation, you want native browser scroll.

The hash-jump pattern:

```tsx
items={[
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
]}
```

`<section id="how-it-works">` on the receiving end. The target id is a stable contract — sitemap anchors, footer links, and analytics events all reference it.

### Hydration safety

`prerender: true` runs your components in Node at build time. `window`/`document`/`localStorage` are unavailable. Guards:

- Every DOM call wrapped in `if (typeof document === 'undefined') return` (or `useEffect`).
- Every storage read/write wrapped in `if (typeof window === 'undefined') return`.
- State that depends on the runtime environment (cookie consent value, scroll position) — render the empty/null state on the server, then update inside `useEffect` after mount. Track a `hydrated` flag if needed.
- Random IDs / dates that would diverge between SSR pass and hydration: generate inside `useEffect` and stash in state.

`suppressHydrationWarning` on `<html>` and `<body>` already silences extension-injected nodes — don't add it elsewhere to silence warnings; fix the root cause.

### Cookie consent + analytics gate

`useCookieConsent` reads `localStorage` inside `useEffect`, exposes `consent`/`hydrated`/`accept`/`decline`. `<CookieConsent>` returns `null` until hydrated AND when consent already set. `<Analytics enabled={consent === 'accepted'}>` mounts the GA4 script only after consent. Both modules render in `App()` next to `<Outlet />`:

```tsx
export default function App() {
    const { consent, hydrated, accept, decline } = useCookieConsent()
    return (
        <>
            <Outlet />
            <Analytics enabled={consent === 'accepted'} />
            <CookieConsent consent={consent} hydrated={hydrated} onAccept={accept} onDecline={decline} />
        </>
    )
}
```

### Env vars

Only `VITE_*` prefix — those are inlined at build time. Server-only env doesn't exist (no server runtime). Read once, type explicitly:

```ts
const gaId = import.meta.env.VITE_GA4_ID as string | undefined
if (!gaId) return
```

Mirror every var in `.env.example` with a placeholder. `.env` is gitignored; `.env.example` is committed.

---

## Recipes

### Add a new route

1. Create `app/routes/foo.tsx` — `meta()` + default page composing modules.
2. Add `route('foo', 'routes/foo.tsx')` to `app/routes.ts`.
3. Add `<url><loc>https://<domain>/foo</loc>...</url>` to `public/sitemap.xml`.
4. Optional: link from `Navbar` (cross-page absolute path) and/or `Footer` `legalLinks`.

### Add a new section module

1. Create `app/modules/Foo.tsx` — named export `export const Foo: React.FC = () => ...`.
2. Pick a UI primitive from the library, hand it static content.
3. Wrap in `<section id="foo">` if anchor navigation should land on it.
4. Compose into the route(s) that need it. Add `{ label: 'Foo', href: '#foo' }` to `Navbar` items if anchor-jumpable.

### Add SEO to a new route

Required `meta()` shape — copy from an existing route, swap title/description/URLs:

```tsx
export function meta({}: Route.MetaArgs) {
    return [
        { title: '...' },                                // < 60 chars
        { name: 'description', content: '...' },         // < 160 chars
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: '<absolute>' },
        { property: 'og:title', content: '...' },
        { property: 'og:description', content: '...' },
        { property: 'og:image', content: '<absolute>' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: '<absolute>' },
        { name: 'twitter:title', content: '...' },
        { name: 'twitter:description', content: '...' },
        { name: 'twitter:image', content: '<absolute>' },
    ]
}
```

OG image MUST be 1200×630, < 1 MB, hosted under `/imgs/` (absolute URL in the meta tag).

### Add an env var

1. Add `VITE_FOO=...` to `.env.example` with a placeholder.
2. Add it to `.env` locally.
3. Read with `import.meta.env.VITE_FOO as string | undefined` — narrow before use.
4. Document where it's consumed.

### Scaffold a new static-app workspace

Create `<app>/` with:

- `package.json` — `"type": "module"`, `"engines": { "node": ">=24" }`, scripts:
  ```json
  "dev": "react-router dev",
  "build": "react-router build",
  "preview": "vite preview",
  "typecheck": "react-router typegen && tsc --noEmit"
  ```
  Deps: `react`, `react-dom`, `react-router`, `@react-router/node`, `@react-router/dev` (dev), `vite` (dev), `vite-plugin-commonjs` (dev), TS toolchain.
- `react-router.config.ts` — `{ prerender: true, ssr: false }`.
- `vite.config.ts`:
  ```ts
  import { reactRouter } from '@react-router/dev/vite'
  import { defineConfig } from 'vite'
  import commonjs from 'vite-plugin-commonjs'
  export default defineConfig({
      plugins: [commonjs(), reactRouter()],
      server: { allowedHosts: ['<host-list>'], host: '0.0.0.0' },
      resolve: { tsconfigPaths: true },
  })
  ```
- `tsconfig.json` — `"include": ["app", ".react-router/types/**/*"]`, `"rootDirs": [".", "./.react-router/types"]`, `"jsx": "react-jsx"`, `strict`, `moduleResolution: "bundler"`.
- `.env.example` with placeholders.
- `app/root.tsx`, `app/routes.ts` (with `index('routes/index.tsx')`), `app/app.css`.
- `app/routes/index.tsx` placeholder with `meta()` + minimal page.
- `app/modules/Navbar.tsx` + `app/modules/Footer.tsx` placeholders.
- `public/favicon.ico`, `public/robots.txt`, `public/sitemap.xml`, `public/imgs/`.
- `Dockerfile` — multi-stage `node:24-alpine` build → `nginx:alpine` static serve from `build/client`.

### Add the Docker build

Multi-stage, nginx-served. Pin Node version, no SSR runtime needed:

```dockerfile
FROM node:24-alpine AS build-env
COPY . /app/
WORKDIR /app
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=build-env /app/build/client /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/index.html $uri.html /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`try_files` order matters: matches `/foo`, `/foo/index.html`, `/foo.html`, then SPA-fallback to `/index.html`. The fallback exists for client-side routes that weren't prerendered (e.g., 404 → ErrorBoundary).

---

## Anti-Patterns

- ❌ `loader`/`action` in route files. They run at **build** time only. Treat them as static-data fetchers — and even then, prefer inlining the data in the route file. If you need runtime data, you're in the wrong skill.
- ❌ Importing `useState` initializer that touches `window`/`localStorage`. Prerender will crash. Move into `useEffect`, set state after mount, render placeholder until hydrated.
- ❌ `<Link to="#section">` for anchor jumps. Use plain `<a href="#section">` + scroll-into-view.
- ❌ Adding a `services/` or `state/` folder. This is a static site — no domain layer, no client store.
- ❌ Per-module SCSS files. Tailwind utilities + UI library styles. Drop into `app.css` `@theme` for tokens.
- ❌ Importing from `app/routes/` outside `routes.ts`. Routes don't share code with each other. Shared UI = a module.
- ❌ Forgetting the sitemap entry on a new route. SEO audits will flag it.
- ❌ Forgetting `meta()`. The page inherits the parent route's title — wrong, bad for SEO.
- ❌ OG image referenced as a relative URL. Crawlers want absolute URLs. Always `https://<domain>/imgs/og-...`.
- ❌ Env var without `VITE_` prefix in client code. It won't be inlined at build time — `import.meta.env.X` will be `undefined`.
- ❌ Mixing UI primitives libraries. Pick one (`@toolcase/react-components`, MUI, Chakra, etc.) per app.
- ❌ Adding `ssr: true` to `react-router.config.ts` to "fix" hydration issues. That requires a Node runtime in production — the nginx-only Dockerfile no longer works. Fix the hydration root cause instead.
- ❌ Storing user state in `localStorage` without a hydration flag. The first render shows server output; the second shows storage-derived output. Without a flag the content jumps. Use the `useCookieConsent` pattern.
- ❌ Dynamic routes (`/post/:slug`) without an explicit `prerender: ['/post/...']` list. They'll fail at build time.
- ❌ React Query / SWR / Redux. Static content has no async state to manage; use the prerendered HTML.
