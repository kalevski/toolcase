// Pure per-site access decision (§13, §16: tenant isolation) — no `server-only`,
// no I/O. Every site mutation/read must re-check ownership server-side: a standard
// user may only touch a site whose `owner_id` equals their session `sub`, while the
// `owner` role bypasses that check (it manages every site). The decision lives here
// so it can be unit-tested directly; `services/sites.ts` wraps it with the
// `siteRepo` lookup and maps the rejection to an HTTP status.
//
// See notes/static-hosting-app-design.md §13, §16.

import type { Role, Site } from './types'

/** The viewer a site access is resolved against — the freshly re-read session id + role. */
export interface SiteViewer {
    /** GitHub numeric id from the verified session (`SessionPayload.sub`). */
    sub: number
    /** Role re-read from SQLite this request (`authorize` result), not the cookie. */
    role: Role
}

/**
 * Result of {@link resolveSiteAccess}: the site when the viewer may act on it, or a
 * typed rejection carrying the HTTP status a route should return.
 *   • `404` — no such site (also the not-leaked answer is *not* used here).
 *   • `403` — the site exists but belongs to another user (ownership check failed).
 */
export type SiteAccess =
    | { ok: true; site: Site }
    | { ok: false; status: 403 | 404 }

/**
 * Decide whether `viewer` may act on `site` (§13). A missing site is `404`; a site
 * owned by someone else is `403` (the ownership re-check `site.owner_id === sub`
 * failed). The `owner` role bypasses the ownership check entirely — it can read,
 * update, and delete any site. Never trust a client-supplied id alone: the caller
 * passes the row it looked up by id, and this is the gate before any mutation (§16).
 */
export function resolveSiteAccess(site: Site | undefined, viewer: SiteViewer): SiteAccess {
    if (!site) return { ok: false, status: 404 }
    if (viewer.role === 'owner' || site.ownerId === viewer.sub) return { ok: true, site }
    return { ok: false, status: 403 }
}
