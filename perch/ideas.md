# Perch — New Feature Ideas

> Scope: **new product capabilities** for `perch/` (the GitHub-branch → static-site control plane that drives nginxpilot). This is *not* a UI-polish list — `plan_details.md` already covers theming, loading states, a11y, and component reuse. The ideas here add things perch **cannot do today**.
>
> Each idea names the concrete hooks (services, repositories, tables, routes, nginxpilot endpoints) it would touch, so it can be scoped without re-deriving the architecture.

---

## How the current system is shaped (1-paragraph recap)

Perch is a single-owner control plane. A `Site` row points at `repoOwner/repoName@branch[/subdir]`; nginxpilot polls that branch on an interval and serves the latest commit, keeping the last-known-good release if a sync fails. Plans are **not stored** — they are resolved per request from GitHub Sponsorships through an owner-editable `plan_tier` ($-cents → plan) table. Quotas (`maxSites`, `maxBytesPerSite`, `maxBytesTotal`, `customDomains`, `minIntervalSec`, `keepReleases`, `privateRepos`) are enforced in the control plane (`services/quota.ts`, `domain/quota.ts`) with a reversible grace→suspend ladder for byte overages. Owner admin covers Sites/Users/Domains/Plans/Audit. Maintainers get a raw nginxpilot routing surface (proxies/upstreams). Auth is GitHub OAuth → HMAC session cookie; the OAuth token is ephemeral and never persisted.

Remaining gaps this list targets: **no per-site configuration** (redirects/headers/SPA fallback), **no programmatic surface** (no API tokens, no CLI), **no TLS-cert visibility**, and **operational dead-ends** in admin (no unsuspend, no fleet overview).

---

## 1. Per-site redirects, headers, and SPA fallback
**Today:** sites are served as raw static files. No redirect rules, no custom headers (CSP/CORS/cache), no SPA `index.html` fallback for client-side routing.
**Idea:** A site-config surface (`_perch.toml`/`_redirects` in the repo, *or* a UI editor) for: 301/302 redirects, custom response headers, `Cache-Control` per glob, and a "single-page app" toggle (404 → `index.html`).
**Hooks:** extend `nginxpilot-fragment.ts` `renderFragment()` to emit `redirects`, `headers`, `spa_fallback` blocks; nginxpilot must translate them into nginx directives. New `Site` columns or a `site_config` table. New PATCH path on `/api/sites/{id}`. Validate rules in a new `domain/site-config.ts` (pure, testable like `hostname.ts`).
**Why:** without SPA fallback, React/Vue Router sites 404 on deep links — a common deal-breaker for the exact audience perch targets.

## 2. Programmatic API + personal access tokens
**Today:** the only credential is the HMAC session cookie; everything is web-UI-only. No CLI, no CI integration.
**Idea:** Issue scoped personal access tokens (`perch_pat_…`) so users can script: create/list/redeploy sites, read status, manage domains. Ship a thin CLI (`perch deploy`, `perch open`, `perch status`).
**Hooks:** new `api_token` table `{ id, githubId, name, hashedToken, scopes, lastUsedAt, createdAt }`; extend `services/auth.ts` `getSession()` to also accept `Authorization: Bearer perch_pat_…` and resolve to a synthetic session; document the existing REST routes as the public API surface (they already return machine-readable `{ error: code }`). Token management UI under a new "Settings" page; audit `token.create/revoke`.
**Why:** the API already exists and is clean (thin routes, policy in services) — it just isn't reachable without a browser cookie. This is high-value, low-surface-area.

## 3. SSL/TLS certificate status & lifecycle
**Today:** custom-domain certs are issued via certbot during `verifyCustomDomain`/`provisionCustomVhost`, but there is **no UI** for cert status, expiry, or renewal failures — and no visible auto-renew.
**Idea:** Cert panel per custom-domain site: issued/expiry dates, issuer, renewal status, "renew now". Owner-wide cert dashboard (expiring soon, failed renewals).
**Hooks:** `infrastructure/nginx.ts` already shells out to certbot — add `certInfo(domain)` (parse `certbot certificates` or read the cert file) and a renewal cron (mirror `sponsors-reconcile.ts`'s ticker). New `GET /api/sites/{id}/cert`.
**Why:** silent cert expiry = silent outage; today nothing watches it.

## 4. Self-service unsuspend / appeal + suspend reasons
**Today:** owner can `suspendSite`, but `AdminSites` exposes **no unsuspend** action, and suspension carries no reason. Auto-suspend (over-quota) has a reinstate path; manual suspend is a dead end.
**Idea:** Add `reinstateSite` to admin, attach a reason string to suspensions, show the reason to the affected user with a remediation CTA (upgrade / contact owner).
**Hooks:** `services/admin.ts` gains `reinstateSite(actor, id)`; `Site` gets `suspendReason`/`suspendedBy`; `deploy-machine.ts` already has the reverse transition (reinstate) — wire a manual path. Route `POST /api/admin/sites/{id}/reinstate`. Audit `site.reinstated` already exists.
**Why:** closes an obvious one-way-door bug in the current admin surface.

## 5. Owner dashboard / fleet health metrics
**Today:** `/admin` is a 5-card hub with no numbers. The owner has no at-a-glance view of fleet health.
**Idea:** Summary tiles: total sites by status (live/failed/over-quota/suspended), total storage vs capacity, signups over time, active sponsorships by tier, failing deploys right now, certs expiring soon.
**Hooks:** new `services/admin-stats.ts` aggregating across `site-repo.list`, `user-repo.list`, `sponsorship-repo.listActive`, plan-tier mapping; new `GET /api/admin/stats`. Pure aggregation in a testable `domain/admin-stats.ts`. Pairs with certs (#3) for the "expiring soon" tile.
**Why:** the owner currently flies blind on the health of the whole platform.

---

## Quick wins (small, self-contained, ship independently)

1. **Unsuspend button** in `AdminSites` — the reinstate transition already exists in `deploy-machine.ts` (subset of #4).
2. **Per-site "deployed N min ago / next sync in M" indicator** — `/status` already returns `next_sync`; just surface it.
3. **Copy-as-curl / "Verify DNS" live status** on the wizard custom-domain step — `verify-domain` route already exists; poll it inline.
4. **Suspension reason field** — one `Site` column + show it to the user (subset of #4).
5. **Audit CSV export** — `audit-repo.list` filtering already supports it; add `?format=csv` to `GET /api/admin/audit`.
6. **`robots.txt` / `sitemap.xml` defaults toggle** — small `renderFragment` option (subset of #1).
7. **Per-site favicon/OG-image health check** — cheap "looks deployed" signal using the existing status poll.

---

## Suggested sequencing

1. **Unsuspend + suspend reasons (#4)** — closes a one-way-door bug; cheapest, reuses the existing reinstate transition.
2. **Redirects / headers / SPA fallback (#1)** — removes the most common reason a real site can't run on perch.
3. **SSL cert status (#3)** — prevents silent cert-expiry outages; certbot is already wired.
4. **Owner dashboard (#5)** — fleet visibility; pure aggregation over existing repos, pairs with #3.
5. **API tokens + CLI (#2)** — programmatic surface; rides on the already-centralized `getSession` seam.

> Architectural note: **#3 (cert status)** needs `infrastructure/nginx.ts` to read certbot state, and **#1 (redirects/headers/SPA)** needs nginxpilot to translate new `renderFragment` blocks into nginx directives. Decide that nginxpilot boundary early — it gates #1 and #3. #2, #4, and #5 are pure perch-side and have no nginxpilot dependency.
