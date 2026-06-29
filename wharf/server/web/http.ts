// Route-handler helpers — the thin seam between API routes and services
// (blueprint §web, planning §9.1, §10). Contract: guard → parse → validate →
// service → audit → json.

import 'server-only'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { authorize, getSession, type AuthzResult } from '@/server/services/auth'
import { config } from '@/server/config'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as projectRepo from '@/server/data/repositories/project-repo'
import * as memberRepo from '@/server/data/repositories/project-member-repo'
import {
    PROJECT_ROLE_RANK,
    type ProjectRole,
    type Role,
    type SessionPayload,
} from '@/server/domain/types'

export function json(data: unknown, status = 200): NextResponse {
    return NextResponse.json(data, { status })
}

export function error(message: string, status: number): NextResponse {
    return NextResponse.json({ error: message }, { status })
}

/** Raised by assertSameOrigin for a cross-site mutation — guards map it to 403 (wharf I1). */
export class CrossOriginError extends Error {}

/** The configured trusted origin (PUBLIC_ORIGIN, falling back to OAUTH_REDIRECT_URI). */
function trustedOrigin(): string {
    try {
        return config.publicOrigin.replace(/\/+$/, '')
    } catch {
        return ''
    }
}

/**
 * Defense-in-depth CSRF check (wharf I1). The cookie is `sameSite: 'lax'`, which
 * already blocks cross-site cookie-bearing POST/PATCH/PUT/DELETE, but the documented
 * route-layer same-origin check was absent — and a future GET-mutating route would
 * be exposed. For an unsafe (mutating) method we reject any request whose `Origin`
 * or `Sec-Fetch-Site` proves it is cross-site.
 *
 * Allowed (matching the existing auth model — instance keys / non-browser clients
 * hit the Agent API, not these cookie-guarded routes): same-origin browser requests,
 * `Sec-Fetch-Site: same-origin|none`, and requests with NO `Origin`/`Sec-Fetch-Site`
 * at all (non-browser clients — they carry no ambient cookie a CSRF could ride).
 * Throws CrossOriginError only when a header positively indicates cross-site.
 */
export async function assertSameOrigin(): Promise<void> {
    const h = await headers()
    const method = (h.get('x-http-method') ?? '').toUpperCase()
    // next/headers does not expose the verb directly; Next mirrors it onto a
    // request header in app routes only sometimes, so we rely on the fetch-metadata
    // / Origin signals which a browser sends on every cross-site mutation regardless.
    void method

    const fetchSite = h.get('sec-fetch-site')
    if (fetchSite) {
        // Browser told us the relationship outright. Only 'cross-site'/'same-site'
        // (a different subdomain) are rejected; 'same-origin' and 'none' (a
        // user-initiated/top-level navigation) are allowed.
        if (fetchSite === 'cross-site' || fetchSite === 'same-site') {
            throw new CrossOriginError('cross-site request rejected')
        }
        return
    }

    // No fetch-metadata — fall back to Origin host comparison when present.
    const origin = h.get('origin')
    if (!origin) return // non-browser client (no ambient cookie risk) — allow.

    const trusted = trustedOrigin()
    let originHost: string
    try {
        originHost = new URL(origin).origin
    } catch {
        throw new CrossOriginError('malformed Origin')
    }
    if (trusted) {
        if (originHost !== trusted) throw new CrossOriginError('cross-origin request rejected')
        return
    }
    // No configured trusted origin: compare against the request's own Host.
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (host && new URL(origin).host !== host) {
        throw new CrossOriginError('cross-origin request rejected')
    }
}

/** Guard a route by minimum GLOBAL role. Returns the authorized result or a 401/403. */
export async function guard(
    minRole: Role,
): Promise<{ res: NextResponse } | Extract<AuthzResult, { ok: true }>> {
    try {
        await assertSameOrigin()
    } catch (e) {
        if (e instanceof CrossOriginError) return { res: error('forbidden', 403) }
        throw e
    }
    const result = await authorize(minRole)
    if (!result.ok) {
        return { res: error(result.status === 401 ? 'unauthorized' : 'forbidden', result.status) }
    }
    return result
}

/** Successful project-scoped authorization (planning §9.1). */
export interface ProjectAuth {
    session: SessionPayload
    /** Global role (`owner` | `guest`). */
    role: Role
    /** Effective project role; the global owner is treated as `devops`. */
    projectRole: ProjectRole
    isOwner: boolean
    projectId: string
}

/**
 * Guard a route by project membership + minimum PROJECT role (planning §9.1):
 * require any session → the global `owner` short-circuits (treated as devops on
 * every project) → otherwise the project must exist (404) and the caller must hold
 * a membership at/above `minProjectRole` (403). Returns the project auth context.
 */
export async function guardProject(
    projectId: string,
    minProjectRole: ProjectRole,
): Promise<{ res: NextResponse } | ProjectAuth> {
    try {
        await assertSameOrigin()
    } catch (e) {
        if (e instanceof CrossOriginError) return { res: error('forbidden', 403) }
        throw e
    }
    const session = await getSession()
    if (!session) return { res: error('unauthorized', 401) }

    const { getRole } = await import('@/server/services/auth')
    const role = getRole(session.sub) ?? 'guest'

    if (role === 'owner') {
        // Owner outranks any project role everywhere — but the project must exist.
        if (!projectRepo.byId(projectId)) return { res: error('not found', 404) }
        return { session, role, projectRole: 'devops', isOwner: true, projectId }
    }

    if (!projectRepo.byId(projectId)) return { res: error('not found', 404) }
    const membership = memberRepo.getMembership(projectId, session.sub)
    if (!membership) return { res: error('forbidden', 403) }
    if (PROJECT_ROLE_RANK[membership.projectRole] < PROJECT_ROLE_RANK[minProjectRole]) {
        return { res: error('forbidden', 403) }
    }
    return { session, role, projectRole: membership.projectRole, isOwner: false, projectId }
}

/**
 * Record who did what — best-effort (an audit failure never blocks the mutation).
 * Accepts any guard result carrying a `session`.
 */
export function audit(
    auth: { session: SessionPayload },
    action: string,
    projectId?: string | null,
    detail?: string | null,
): void {
    try {
        auditRepo.append({
            githubId: auth.session.sub,
            login: auth.session.login,
            action,
            projectId,
            detail,
        })
    } catch {
        /* best-effort */
    }
}

/** Audit entry for non-user actors (scheduler / agent fetch). */
export function auditSystem(action: string, projectId?: string | null, detail?: string | null): void {
    try {
        auditRepo.append({ githubId: null, login: 'system', action, projectId, detail })
    } catch {
        /* best-effort */
    }
}
