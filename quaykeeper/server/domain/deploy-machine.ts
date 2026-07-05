// Pure deploy orchestration — the `draft → provisioning → live → (failed |
// suspended)` site-lifecycle state machine (§9), expressed over *injected* ports so
// it carries no `server-only` guard and can be unit-tested with a mocked nginxpilot
// client and an in-memory store. The thin `services/deploy.ts` wrapper supplies the
// real ports (the `infrastructure/nginxpilot.ts` client + `siteRepo` + `auditRepo`).
//
// This mirrors the project's "pure decision logic in `domain/`, server-only wiring in
// `services/`" split (see `domain/plan-resolution.ts` ↔ `services/plan.ts`): a service
// can't be imported under vitest (the `server-only` shim throws), so the load-bearing
// sequence lives here where it can be exercised directly.
//
// See notes/static-hosting-app-design.md §4, §9, §11.

import type { Site, SiteStatus } from './types'
import type { FragmentOptions } from './nginxpilot-fragment'
// Type-only imports of the nginxpilot client surface — erased at compile, so pulling
// them in never executes that `server-only` module under vitest.
import type { NginxpilotSiteStatus, NginxpilotStatus } from '../infrastructure/nginxpilot'

// ── injected ports ─────────────────────────────────────────────────────────────

/** The slice of the nginxpilot client the state machine drives (both channels, §4). */
export interface DeployClient {
    /** Channel A: render the site's fragment and write it via `POST /sites` (atomic). */
    writeFragment(site: Site, options: FragmentOptions): Promise<string>
    /** Channel A: remove the site's fragment via `DELETE /sites/{domain}` (idempotent). */
    removeFragment(domain: string): Promise<void>
    /** Channel A: reload nginxpilot (idempotent after a write — the API already reloaded). */
    reload(): Promise<void>
    /** Channel B: `POST /sync/{domain}` — force an immediate deploy. */
    sync(domain: string): Promise<void>
    /** Channel B: `GET /status` — per-site sync state for the live UI. */
    status(): Promise<NginxpilotStatus>
}

/** The slice of `siteRepo` the state machine writes through (each call bumps `updated_at`). */
export interface DeployStore {
    updateStatus(id: string, status: SiteStatus, at?: string): void
    updateLastError(id: string, lastError: string | null, at?: string): void
    updateLastRef(id: string, lastRef: string, at?: string): void
    updateBytes(id: string, bytes: number, at?: string): void
    updateSource(id: string, branch: string, subdir: string | undefined, at?: string): void
    remove(id: string): void
}

/** Everything the machine needs that the service binds to real infrastructure. */
export interface DeployDeps {
    client: DeployClient
    store: DeployStore
    /** Render options for a site (poll interval from the owner's plan, gates, auth). */
    fragmentOptions(site: Site): FragmentOptions
    /** Append one audit entry per lifecycle transition (actor resolved by the service). */
    audit(action: string, site: Site, detail?: string): void
    /** Injected clock (ISO string) — keeps transitions and tests deterministic. */
    now(): string
    /** Injected sleep for the `track()` poll loop. */
    sleep(ms: number): Promise<void>
}

/** Editable source fields on `update()` (§9 step 6: branch/subdir changes re-render). */
export interface SiteSourceChanges {
    branch?: string
    /** `null`/`undefined` clears the build subdir; absent leaves it unchanged. */
    subdir?: string | null
}

/** Poll-loop tuning for `track()`. */
export interface TrackOptions {
    /** Max `GET /status` polls before giving up on reaching `live` (default 20). */
    attempts?: number
    /** Delay between polls, ms (default 3000). */
    intervalMs?: number
}

const DEFAULT_TRACK_ATTEMPTS = 20
const DEFAULT_TRACK_INTERVAL_MS = 3000

// ── status interpretation (the last-known-good policy, §9 step 5) ──────────────

/** What one `/status` reading means for the `site` row — pure, hence unit-tested. */
export interface StatusTransition {
    /** Status to persist now (the suspended/over_quota states are owned elsewhere). */
    status: Extract<SiteStatus, 'provisioning' | 'live' | 'failed'>
    /** New `last_ref` to persist; `undefined` leaves the stored ref untouched. */
    lastRef?: string
    /** `last_error` to persist; `null` clears it. */
    lastError: string | null
    /** Deployed size if nginxpilot reported it (§11/§17 field); else `undefined`. */
    bytes?: number
    /** True once the site is serving a healthy release and tracking can stop. */
    live: boolean
}

/**
 * Interpret one nginxpilot site status into a `site`-row transition, encoding the
 * last-known-good guarantee (§9 step 5): a failed push never tears down the prior
 * release, so when nginxpilot reports an error *and* still has a `current` ref, we
 * record `failed` but keep the still-serving ref. `st === undefined` means the
 * fragment isn't visible to nginxpilot yet (reload not yet applied) — keep waiting.
 */
export function interpretStatus(st: NginxpilotSiteStatus | undefined, site: Site): StatusTransition {
    if (!st) {
        return { status: 'provisioning', lastError: site.lastError ?? null, live: false }
    }
    // A `current` ref only exists once the site has synced at least once.
    const servingRef = st.never_synced ? undefined : st.deployed_ref
    const failing = !!st.last_error || st.failure_streak > 0

    // Healthy: a release is being served and the most recent sync didn't error.
    if (servingRef && !failing) {
        return { status: 'live', lastRef: servingRef, lastError: null, bytes: st.bytes, live: true }
    }
    // Last-known-good: newest push failed, but a prior release is still served.
    // Surface `failed` while keeping the still-live ref + the explaining error.
    if (servingRef && failing) {
        return {
            status: 'failed',
            lastRef: servingRef,
            lastError: st.last_error ?? 'sync failed',
            bytes: st.bytes,
            live: false,
        }
    }
    // Hard first-deploy failure: never reached a good release and the sync errored.
    if (failing) {
        return { status: 'failed', lastError: st.last_error ?? 'sync failed', live: false }
    }
    // Still syncing / not yet synced, no error — keep polling.
    return { status: 'provisioning', lastError: null, live: false }
}

/**
 * Persist a transition through the store, writing only the fields that actually
 * changed (so polling doesn't flap `updated_at`), and emit one audit entry when the
 * lifecycle status itself moves. Returns the updated in-memory `Site`.
 */
function persist(deps: DeployDeps, site: Site, t: StatusTransition): Site {
    const at = deps.now()
    let next = site
    if (t.status !== site.status) {
        deps.store.updateStatus(site.id, t.status, at)
        next = { ...next, status: t.status, updatedAt: at }
    }
    const newErr = t.lastError ?? undefined
    if (newErr !== site.lastError) {
        deps.store.updateLastError(site.id, t.lastError, at)
        next = { ...next, lastError: newErr, updatedAt: at }
    }
    if (t.lastRef !== undefined && t.lastRef !== site.lastRef) {
        deps.store.updateLastRef(site.id, t.lastRef, at)
        next = { ...next, lastRef: t.lastRef, updatedAt: at }
    }
    if (t.bytes !== undefined && t.bytes !== site.bytes) {
        deps.store.updateBytes(site.id, t.bytes, at)
        next = { ...next, bytes: t.bytes, updatedAt: at }
    }
    if (t.status !== site.status) {
        deps.audit(`site.${t.status}`, next, t.lastError ?? undefined)
    }
    return next
}

// ── lifecycle transitions (§9 steps 4–7) ──────────────────────────────────────

/**
 * Provision a site (§9 step 4): render+write the fragment, reload nginxpilot, force
 * the first sync, and mark the row `provisioning` (clearing any stale error from a
 * prior failed attempt). The caller follows up with `track()` to drive it to `live`.
 */
export async function provision(deps: DeployDeps, site: Site): Promise<Site> {
    const options = deps.fragmentOptions(site)
    await deps.client.writeFragment(site, options)
    await deps.client.reload()
    await deps.client.sync(site.hostname)
    return persist(deps, site, { status: 'provisioning', lastError: null, live: false })
}

/**
 * Track a provisioning site to a terminal state (§9 step 5): poll `GET /status` until
 * the domain reports a live `current` ref (or the attempt budget is spent), persisting
 * each reading via the last-known-good policy in `interpretStatus`. Returns the final
 * in-memory `Site`.
 */
export async function track(deps: DeployDeps, site: Site, opts: TrackOptions = {}): Promise<Site> {
    const attempts = opts.attempts ?? DEFAULT_TRACK_ATTEMPTS
    const intervalMs = opts.intervalMs ?? DEFAULT_TRACK_INTERVAL_MS
    let current = site
    for (let i = 0; i < attempts; i++) {
        const env = await deps.client.status()
        const st = env.sites.find((s) => s.domain === site.hostname)
        const t = interpretStatus(st, current)
        current = persist(deps, current, t)
        if (t.live) break
        if (i < attempts - 1) await deps.sleep(intervalMs)
    }
    return current
}

/**
 * Redeploy a site (§9 step 6, the "Redeploy" button): just force a fresh sync of the
 * existing fragment. Status is left as-is; the caller may `track()` afterwards.
 */
export async function redeploy(deps: DeployDeps, site: Site): Promise<Site> {
    await deps.client.sync(site.hostname)
    deps.audit('site.redeploy', site)
    return site
}

/**
 * Update a site's source (§9 step 6): when the branch or subdir changes, persist the
 * new values, rewrite the fragment, reload, and force a sync (back to `provisioning`).
 * A no-op change short-circuits without touching nginxpilot.
 */
export async function update(deps: DeployDeps, site: Site, changes: SiteSourceChanges): Promise<Site> {
    const branch = changes.branch ?? site.branch
    const subdir = 'subdir' in changes ? (changes.subdir ?? undefined) : site.subdir
    if (branch === site.branch && subdir === site.subdir) return site

    const at = deps.now()
    const next: Site = { ...site, branch, subdir, status: 'provisioning', updatedAt: at }
    deps.store.updateSource(site.id, branch, subdir, at)
    await deps.client.writeFragment(next, deps.fragmentOptions(next))
    await deps.client.reload()
    await deps.client.sync(next.hostname)
    deps.store.updateStatus(site.id, 'provisioning', at)
    deps.audit('site.update', next, `branch=${branch}${subdir ? ` subdir=${subdir}` : ''}`)
    return next
}

/**
 * Remove a site (§9 step 7): drop the fragment, reload so nginxpilot stops serving it,
 * and delete the row. Custom-domain vhost/cert teardown is handled separately in §729.
 */
export async function remove(deps: DeployDeps, site: Site): Promise<void> {
    await deps.client.removeFragment(site.hostname)
    await deps.client.reload()
    deps.store.remove(site.id)
    deps.audit('site.remove', site)
}

/**
 * Suspend a site (owner moderation, §11/§13): drop the fragment + reload so nginxpilot
 * stops serving it, and mark the row `suspended` — but KEEP the row (unlike `remove`),
 * so the suspension is reversible by re-provisioning. Returns the updated `Site`.
 *
 * Deliberately emits NO audit entry: suspension is the one transition that can be
 * initiated by the platform `owner` rather than the site's own owner, so the moderation
 * record — attributed to the acting owner — is the admin service's responsibility, not
 * this machine's (which would mis-attribute it to the tenant).
 */
export async function suspend(deps: DeployDeps, site: Site): Promise<Site> {
    await deps.client.removeFragment(site.hostname)
    await deps.client.reload()
    const at = deps.now()
    deps.store.updateStatus(site.id, 'suspended', at)
    return { ...site, status: 'suspended', updatedAt: at }
}
