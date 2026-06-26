# Perch UI Modernization & UX Plan

> Scope: the full web UI of `perch/` — a Next.js 16 + React 19 control plane that deploys a user's GitHub branch as a static site via nginxpilot. The UI is built entirely on the `@toolcase/web-components` (`tc-*`) library (light-DOM, global stylesheet, Bootstrap-compatible classnames + a `--tc-*` design-token system).

---

## 0. Implementation status (2026-06-26)

Phases 0–2 are **implemented and type-clean** (`tsc --noEmit` passes; the only error is the pre-existing `server/data/db.ts` `node:sqlite` types gap, unrelated to the UI). Highlights from Phase 4 also landed. The heavier Phase 3 items and remaining Phase 4 polish are **deferred** — they need a running browser to build and verify safely.

**Done**
- **WS-3** — `lib/fetcher.ts` (`apiFetch` with timeout + typed `ApiError`), `lib/me-context.tsx` (`MeProvider`/`useMe`). `AuthGate` provides `me`; `DashboardHome`, `PlansView`, `SiteDetail`, and the admin/routing gates now read it instead of refetching `/api/me`.
- **WS-4** — `components/states.tsx` (`LoadingState` skeletons, `ErrorState` + Retry, `EmptyState`), wired into `AuthGate`, `DashboardHome`, `SiteDetail`, `PlansView`, and the admin/routing page frames.
- **WS-1** — `app/globals.css` fully tokenized (zero hex outside the `:root`/dark-mode token definitions); tinted fills use `color-mix`; **dark mode** auto-applies via `prefers-color-scheme`. *Caveat:* some `tc-*` components still bake light-theme literals upstream (see `wc-dark-theme-literal-traps` memory) — dark mode is correct for perch's own CSS but may need follow-up in the library.
- **Phase 1** — `components/ConfirmDialog.tsx` replaces all four `window.confirm()` calls (AdminSites suspend, AdminDomains remove, routing Proxies/Upstreams delete); **type-to-confirm** on site delete (SiteDashboard). `components/Toast.tsx` (`ToastProvider`/`useToast`) for redeploy, role-change, and limit-save feedback. Login error → `tc-banner`; login + redirect spinner.
- **Phase 2** — `tc-breadcrumb` trail (`components/Breadcrumbs.tsx`), admin hub at `/admin` (`components/admin/AdminHome.tsx`), `app/not-found.tsx`, skip-to-content link + `#perch-main`, and a Cmd/Ctrl-K `tc-command-palette` (`components/CommandPalette.tsx`).
- **Phase 4 (partial)** — visibility-aware grid polling in `DashboardHome`; `SiteCard` surfaces "Status unavailable" instead of a stuck "Loading…".
- **Quick wins** — MB→MiB label (AdminUsers), cents→dollars hint (AdminPlans).

**Deferred (need a running app to do safely)**
- **Phase 3** — rebuild routing/wizard/admin editors on `tc-form`/`tc-label`/`tc-helper-text` with on-blur validation; admin tables search/sort/`tc-pagination` + JSX rows (drop the HTML-string injection in AdminSites); wizard DNS-snippet copy button + live ingress IP.
- **Phase 4 (rest)** — relative timestamps, card quick-action menu, per-domain/per-tier impact previews, audit filtering + export, site-detail polling-transparency indicator, SWR/stale-while-revalidate cache.
- **Misc** — logout spinner in AppShell (`tc-user-panel` internals); verifying `tc-side-nav` emits `aria-current` (else an upstream fix).

---

## 1. Executive summary

Perch is functionally complete across five surfaces — **Sites**, **Plans/Sponsor**, **Routing** (Proxies/Upstreams), **Owner Admin** (Sites/Users/Domains/Plans/Audit), and **Auth/Shell**. The screens work, but the UI was assembled incrementally and predates the maturity of the `tc-*` library. The result is a consistent set of gaps rather than a few isolated bugs.

The single highest-leverage observation: **the app reimplements in hand-written `app/globals.css` (873 lines of hardcoded hex) much of what the component library already provides as tokens and components.** Closing that gap fixes theming, dark mode, accessibility, and consistency in one move, and removes most of the custom CSS.

### Current-state scorecard

| Dimension | State | Notes |
|---|---|---|
| Visual consistency | ⚠️ Mixed | Hardcoded hex (`#0ea5e9`, `#6b7280`, `#842029`…) instead of `--tc-*` tokens; ad-hoc `.perch-admin-*` classes duplicate library components. |
| Theming / dark mode | ❌ None | No `tc-theme`, no dark mode, no `prefers-color-scheme`. Login error styled in out-of-brand Bootstrap red. |
| Loading states | ⚠️ Weak | Plain "Loading…" text everywhere; `tc-skeleton`/`tc-spinner` exist but unused. |
| Error handling | ⚠️ Weak | Generic "Refresh the page"; no retry buttons; polling errors swallowed; no fetch timeouts. |
| Feedback / async | ⚠️ Weak | Inline plain-text messages instead of `tc-toast`; no optimistic updates; redeploy/suspend feedback easy to miss. |
| Destructive actions | ❌ Risky | Raw `window.confirm()` in admin + routing; site delete has no type-to-confirm. |
| Real-time | ⚠️ Partial | Per-site detail polls; the Sites **grid** does not refresh after deploys. |
| Navigation / IA | ⚠️ Gaps | No breadcrumbs, no admin hub, no command palette, no 404 page, no skip-link. |
| Forms | ⚠️ Weak | Validate-on-submit only; native `<input>`/`<select>` in routing; unit confusion (cents/MB/bytes); static DNS snippet, no copy button. |
| Tables (admin) | ⚠️ Weak | No search/sort/pagination; rows injected as raw HTML strings; no mobile layout. |
| Accessibility | ⚠️ Gaps | Color-only status; missing `aria-current`/`aria-controls`/`aria-label`; low-contrast greys; no fieldsets. |
| Data fetching | ⚠️ Wasteful | Duplicate `/api/me` fetches; `cache: 'no-store'` on rarely-changing data; no SWR/caching. |

---

## 2. Guiding principles

1. **Reuse the library before writing CSS.** Every new style should first ask "does a `tc-*` component or `--tc-*` token already do this?" The answer is almost always yes. Target: shrink `globals.css` to layout-only glue.
2. **Tokens, never literals.** All color/spacing/typography flows through `--tc-*` (design tokens) and `--bs-<component>-*` (theming contract). No new hex literals.
3. **Every async action has four states.** idle → loading (skeleton/spinner) → success (toast/optimistic) → error (inline + retry). No silent failures, no dead-ends that say "refresh the page".
4. **Destructive = deliberate.** No `window.confirm()`. Use `tc-confirm-dialog`; type-to-confirm for irreversible deletes.
5. **Accessible by default.** Status never by color alone; `aria-current` on nav; labels associated; contrast ≥ WCAG AA; honour `prefers-reduced-motion` (the library already does).
6. **Respect the styleguide.** Sharp corners (no `border-radius` except pills/circles), Inter for prose + JetBrains Mono for machine text, cyan accent used sparingly, lucide inline SVG icons.

---

## 3. Cross-cutting workstreams

These touch every screen and should land first — they de-risk and accelerate the per-screen work.

### WS-1 — Theme & design tokens (foundation)

**Problem.** `globals.css` hardcodes ~60 hex values. Greys like `#6b7280`/`#94a3b8` risk failing AA. Login error uses Bootstrap red (`#842029`) that clashes with the sky-blue brand. No dark mode.

**Actions.**
- Replace every literal in `globals.css` with the matching token: surfaces → `--tc-surface`/`--tc-surface-muted`; borders → `--tc-border`/`--tc-border-strong`; text → `--tc-text`/`--tc-text-muted`/`--tc-text-faint`; status → `--tc-success`/`--tc-warning`/`--tc-danger`/`--tc-info`; mono → `--tc-font-mono`.
- Drive component cosmetics through `--bs-<component>-*` overrides rather than wrapping components in custom classes.
- Wrap the app shell in `<tc-theme>` and add a **dark mode** path (the library's `aurora` theme is a dark skin; tokens are dark-ready). Add a theme toggle in the `tc-user-panel` and respect `prefers-color-scheme` on first load.
- Delete the bespoke status colors in `.perch-admin-status--*`, `.perch-wizard-error`, `.perch-wizard-success`, login error styles — replace with `tc-banner`/`tc-badge` variants.

**Payoff.** Dark mode, AA contrast, brand consistency, and a much smaller stylesheet — all at once.

### WS-2 — Adopt unused library components

The library ships these but perch doesn't use them. Map each to where it's needed:

| Component | Replaces / adds | Where |
|---|---|---|
| `tc-confirm-dialog` | `window.confirm()` | Admin Sites suspend, Admin Domains remove, Routing delete |
| `tc-toast` | inline plain-text status | Redeploy started, site created, role changed, save succeeded |
| `tc-skeleton` | "Loading…" text | Sites grid, site detail, plans, all admin lists, routing lists |
| `tc-spinner` | nothing (no busy affordance) | Login button, logout, in-flight buttons |
| `tc-badge` / `tc-badge-row` | hand-styled status spans | Site status, user level/plan badges, proxy/server health |
| `tc-status-dot` | custom dots | Site card, server health |
| `tc-breadcrumb` | nothing | Every page below the top level (Admin › Users, etc.) |
| `tc-command-palette` | nothing | Global Cmd/Ctrl-K quick-jump to sites & pages |
| `tc-pagination` | render-everything | Admin Sites, Users, Audit |
| `tc-form` / `tc-helper-text` / `tc-label` | native HTML + custom labels | Routing forms, wizard, admin editors |
| `tc-tabs` / `tc-collapse` | flat dense rows | Upstream server "advanced" options, proxy locations |

### WS-3 — Data-fetching & state layer

**Problem.** `AuthGate` fetches `/api/me`, then `PlansView` and `CreateSiteWizard` fetch it again. All fetches use `cache: 'no-store'`. No timeouts, so a hung request hangs the UI forever. Polling errors are swallowed.

**Actions.**
- Introduce a lightweight client cache (SWR or a small `useFetch` with stale-while-revalidate). Plans/me/base-domains rarely change — cache with a short stale time.
- Thread `me` down from `AuthGate` → `AppShell` → children via context/props; stop refetching it.
- Wrap fetches in `AbortController` with a ~10s timeout; surface timeout distinctly from 4xx/5xx.
- Centralize error mapping (401 → "session expired, sign in again", 403 → "not provisioned", 5xx/timeout → "server unreachable, retry") so messages are specific and consistent.

### WS-4 — Loading / error / empty pattern kit

Create three reusable wrappers used by **every** data view:
- `<LoadingState>` → `tc-skeleton` shaped like the target content (cards/rows/table), not blank text.
- `<ErrorState>` → `tc-banner variant="danger"` with a **Retry** button (re-runs the fetcher) and a specific message; never "refresh the page".
- `<EmptyState>` → `tc-empty-state` with an actionable CTA.

Replace the bespoke loading/error blocks in `AuthGate`, `DashboardHome`, `SiteDetail`, `PlansView`, `shared.tsx` (routing) and `admin/shared.tsx` with these.

### WS-5 — Navigation & information architecture

- **Breadcrumbs** (`tc-breadcrumb`) under the navbar on all non-root pages.
- **Admin hub** at `/admin` (currently a redirect to Sites): a landing page with cards linking to the five admin areas + summary stats (total sites/users/domains/tiers).
- **Command palette** (`tc-command-palette`, Cmd/Ctrl-K): jump to any site by hostname, or any page.
- **404 page** (`app/not-found.tsx`) inside the shell, with a path back to Sites.
- **Skip-to-content** link before the navbar; ensure `aria-current="page"` is set on the active side-nav item.
- **Explain gated sections**: tooltip on hidden Routing/Admin ("Unlocked for maintainers" / "Owner only") rather than them silently not existing.

### WS-6 — Accessibility pass

- Status never by color alone: pair every status color with an icon or text (`tc-badge` with `icon-name`).
- Associate labels: `tc-label`/`aria-labelledby` on all inputs; `aria-controls` on the Users "Limits" toggle; `aria-describedby` linking help text to fields.
- Audit contrast for `--tc-text-muted`/`--tc-text-faint` usages against their surfaces; bump where they fail AA.
- Group related fields in `<fieldset>`/`tc-field` (admin plan tiers, domain groups).
- Add `aria-busy`/`aria-disabled` to buttons during async work (the markup mostly relies on `disabled` today).

---

## 4. Per-screen findings & improvements

### 4.1 Auth & Shell

**Login (`LoginClient.tsx`)**
- No loading state on the GitHub button; hardcoded out-of-brand error colors; generic error fallback.
- → Add `tc-spinner` + disabled state on click; replace inline error with `tc-banner`; give each OAuth error code a specific, actionable message; explain *why* sign-in is required.

**AuthGate (`AuthGate.tsx`)**
- No retry/timeout; 401 vs 403 vs 5xx collapsed; redundant `/api/me` fetch (WS-3).
- → `AbortController` timeout; specific error mapping; retry button; pass `me` downward instead of refetching.

**AppShell (`AppShell.tsx`)**
- Logout fires `router.push('/login')` before confirming the request and never disables the trigger; no breadcrumbs; nav sections lack visual separation and `aria-current`; gated sections unexplained.
- → Await logout with a spinner + error fallback; add breadcrumbs (WS-5); ensure active-item `aria-current`; tooltips on gated sections.

**Providers / Layout (`providers.tsx`, `layout.tsx`)**
- Returns `null` until `tc-*` registers → blank first paint with no feedback; no favicon; no skip-link; no error boundary.
- → Render a minimal branded splash/`tc-loading-screen` during registration; add favicon (bird); add skip-link + root error boundary.

### 4.2 Sites (core flow)

**DashboardHome (`DashboardHome.tsx`)**
- Grid only refetches when the create modal closes — deploys finishing elsewhere never appear; blank-text loading; no `aria-label` on grid.
- → Poll `/api/sites` on an interval (pause on `visibilitychange`); skeleton cards while loading; auto-dismiss the create-success modal with a toast linking to the new site.

**SiteCard (`SiteCard.tsx`)**
- Independent status poll **swallows errors** → a stale "Loading…" dot lingers indefinitely on backend outages; absolute timestamps; no quick actions; `role="link"` + manual `tabIndex` rather than a native anchor.
- → Distinguish loading vs error (warning icon + tooltip "status unavailable, retrying"); relative timestamps ("2h ago"); overflow menu for redeploy/delete; prefer a native `<a>`.

**SiteDetail (`app/sites/[id]` wrapper)**
- Bare "Loading site…" text; error says "refresh the page" with no retry; custom back-button affordance inconsistent with the rest of the app.
- → Skeleton; `<ErrorState>` with Retry (WS-4); standardize back navigation (breadcrumb or `<a href="/">`).

**SiteDashboard (`SiteDashboard.tsx`)**
- Adaptive polling is invisible (looks stalled); redeploy feedback is an easily-missed inline `<span>`; persistent "Retrying…" banner with no dismiss/retry; delete modal keeps stale state across cancel/reopen; dense single-column layout.
- → "Updated 10s ago · next check in 15s" indicator + manual refresh; `tc-toast` for redeploy; retry/dismiss on the load-error banner; reset delete state on close; **type-to-confirm** deletion (type the hostname); group status/build/storage/actions into clear `tc-section-card`s.

**CreateSiteWizard (`CreateSiteWizard.tsx`)**
- Repo/branch loads have no skeleton; validation only on submit (errors surface as a top banner, not at the field); GitHub fetch failure traps the user in the modal ("refresh" closes it); default-branch preselection isn't signposted; subdir/custom-domain not validated on blur; DNS snippet shows a placeholder IP the user can't know until after creation, and has no copy button.
- → Skeletons/inline retry inside the modal; per-field validation on blur with field-level errors; disable **Next** until the step is valid; badge the default branch "(default)"; resolve and show the real ingress IP (or a "Go to dashboard" handoff) in the success step; add copy-to-clipboard to the DNS snippet and live-update it as the domain changes.

### 4.3 Plans & Sponsor (`PlansView.tsx`)

- Refetches `/api/me` + `/api/sites` + `/api/plans` with `cache: 'no-store'` (WS-3); generic single error message; over-quota banners stack *above* the solution (pricing); sponsor wall silently disappears if its API fails; hero copy over-explains.
- → Accept `me`/`sites` from parent, cache `/api/plans`; reorder so a one-line summary sits on top, then pricing, then per-site detail (collapsible); show "sponsorships temporarily unavailable" instead of a missing section; clearly mark the user's **current** plan (checkmark, not just a badge); tighten copy.

### 4.4 Routing (Proxies & Upstreams)

**Both (`Proxies.tsx`, `Upstreams.tsx`, `shared.tsx`)**
- Built on ad-hoc `.perch-admin-*` classes and **native** `<input>`/`<select>` instead of `tc-form`; `window.confirm()` for delete; validation only on submit; generic "Loading…"/"refresh" states; balancer label hides the real default (`'' → round_robin`); upstream server rows cram 7 controls with no field help; remove-disabled (min 1 server) has no explanation; no health/status indicators.
- → Rebuild forms on `tc-form` + `tc-label` + `tc-helper-text`; `tc-confirm-dialog` for deletes; on-blur validation; `<LoadingState>`/`<ErrorState>` (WS-4); show the resolved default balancer; split server config into basic vs. advanced via `tc-tabs`/`tc-collapse`, with `tc-switch` for backup/down and `tc-number-input` for weight/fails; tooltip the disabled remove; `tc-status-dot`/`tc-badge` for proxy/server state.

### 4.5 Owner Admin

**Hub (`app/admin/page.tsx`)** — currently only redirects. → Build a real hub (WS-5) with section cards + summary stats.

**Sites moderation (`AdminSites.tsx`)**
- No search/sort/pagination (renders everything, `limit = sites.length`); `window.confirm()` suspend; weak busy feedback; **rows injected as raw HTML strings** (fragile, weak a11y); silent `#<githubId>` fallback for unknown owners; six-column table breaks on mobile.
- → Search by host/owner; sortable columns; `tc-pagination`; `tc-confirm-dialog` with "reversible" copy; render rows as JSX; explain the id fallback; responsive/stacked layout on mobile.

**Users roster (`AdminUsers.tsx`)**
- Collapsed limits editor (tedious); **unit confusion** (label "Max MB" but stores bytes; placeholder shows MiB); ambiguous inherit-vs-set blank fields; role change PATCHes instantly with no confirm/undo; cramped wrapping card; color-ranked badges without clear hierarchy; missing `aria-controls` on the Limits toggle.
- → Show a limits summary inline with "custom" highlights and per-field "reset to default"; one consistent unit with explicit conversion; confirm role changes (warn on last-owner before the call); `aria-controls`; clearer badge hierarchy; optional bulk role actions + CSV export.

**Base domains (`AdminDomains.tsx`)**
- `window.confirm()` remove with no impact preview ("X sites orphaned"); empty-state only when *all* tiers empty; always-visible add form with no success feedback; cramped add row; groups are `<div>`+`<h4>` with no semantic association.
- → `tc-confirm-dialog` showing affected-site count; per-tier empty hints; highlight/scroll to newly added domain; `<fieldset>` per tier; show per-domain usage; allow tier migration without remove/re-add.

**Plan tiers (`AdminPlans.tsx`)**
- Validate-on-save only; **cents** input with no dollar display (5000 = $50 is hard to eyeball); destructive-styled remove for a non-destructive config change; labels are sibling `<span>`s, not associated; no `<fieldset>`.
- → Live per-field validation; show dollars alongside cents; auto-sort by threshold to prevent overlaps; associate labels; presets ("Bronze $5 / Silver $10 / Gold $25"); soften the remove styling.

**Audit log (`AdminAudit.tsx`)**
- No filter/search/pagination; brittle manual timestamp slice (`replace('T',' ').slice(0,19)`) with no timezone; icon chosen by string-guessing the action name (breaks silently on rename); opaque `tc-activity-card` with no date grouping.
- → Filter by action type / actor / date range (persist in URL query); `tc-pagination` or infinite scroll; localized timestamps with timezone; a typed action→icon map; group by date; CSV/JSON export for compliance; detail-on-click.

---

## 5. Phased roadmap

### Phase 0 — Foundation (highest leverage, do first)
- **WS-1** token migration in `globals.css` + `tc-theme` wrapper + dark mode toggle.
- **WS-4** `<LoadingState>`/`<ErrorState>`/`<EmptyState>` kit.
- **WS-3** `me` context + fetch timeout + central error mapping.

*Exit:* no hex literals in `globals.css`; dark mode works; one shared loading/error pattern; no duplicate `/api/me`.

### Phase 1 — Safety & feedback (quick, high-impact)
- Replace **all** `window.confirm()` with `tc-confirm-dialog`; type-to-confirm site delete.
- `tc-toast` for redeploy / create / role-change / save.
- Spinners + disabled state on login, logout, and in-flight buttons.
- Skeletons on Sites grid, site detail, plans, admin lists, routing lists.

*Exit:* no native confirms; every async action gives visible feedback; no blank-text loads.

### Phase 2 — Navigation & IA
- Breadcrumbs everywhere; admin hub; command palette (Cmd/Ctrl-K); 404 page; skip-link; `aria-current`; gated-section tooltips.

*Exit:* user always knows where they are and can jump anywhere; keyboard-first navigation works.

### Phase 3 — Forms & data density
- Rebuild routing + wizard + admin editors on `tc-form`/`tc-label`/`tc-helper-text` with on-blur validation and field-level errors.
- Admin tables: search, sort, `tc-pagination`; JSX rows (drop HTML-string injection).
- Fix unit confusion (MB/bytes, cents/dollars); DNS snippet copy button + live IP.

*Exit:* validation is inline and immediate; large lists are searchable/paginated; no unit ambiguity.

### Phase 4 — Real-time & polish
- Sites-grid polling (visibility-aware); polling-transparency indicator on site detail; stale-status surfacing on cards.
- Relative timestamps; quick actions on cards; per-domain/per-tier impact previews; audit filtering + export.
- Client cache (SWR) for plans/me/domains.

*Exit:* the app feels live; power-user affordances in place.

---

## 6. Quick wins (can ship independently, low risk)

1. Replace `window.confirm()` calls (3 sites) with `tc-confirm-dialog`.
2. Login button + logout spinner/disabled state.
3. Login error → `tc-banner` (kills the out-of-brand red).
4. Skeletons on the Sites grid and site detail.
5. `tc-toast` on redeploy + site-created.
6. Retry buttons on every "refresh the page" error.
7. `aria-current` on the active nav item + skip-link.
8. Show dollars next to cents in Admin Plans; fix the MB/bytes label in Admin Users.
9. Copy-to-clipboard on the wizard DNS snippet.
10. Relative timestamps on site cards.

---

## 7. Definition of done (per surface)

A surface is "modernized" when it:
- uses only `--tc-*`/`--bs-*` tokens (zero new hex), and renders correctly in light **and** dark themes;
- has skeleton loading, specific errors with retry, and an actionable empty state;
- gives visible feedback (toast/optimistic/spinner) for every async action;
- guards destructive actions with `tc-confirm-dialog` (type-to-confirm where irreversible);
- passes an a11y check: status not color-only, labels associated, `aria-current`/`aria-controls` set, AA contrast, keyboard-complete;
- reuses library components instead of bespoke `.perch-*` CSS wherever one exists.
