// Routing service (proxies + upstreams) — the policy layer the `/api/routing/**`
// routes call, all reached only after `authorize('maintainer')` (so owners *and*
// maintainers, but never a standard user). It is the maintainer counterpart to the
// owner-only `services/admin.ts`: validate the request with the pure
// `domain/routing.ts` rules, drive nginxpilot's admin API through the
// `infrastructure/nginxpilot.ts` seam, and audit every mutation against the actor.
//
// nginxpilot is the final authority — it re-validates each fragment against its
// running config (unknown upstream reference, duplicate domain, an upstream still
// in use on delete) and answers with a precise status. `httpErrorFor` maps both our
// own pre-flight `RoutingError` and a daemon `NginxpilotError` onto a route-ready
// status + machine-readable code, so a 409 "upstream in use" stays a 409.

import 'server-only'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as np from '@/server/infrastructure/nginxpilot'
import { NginxpilotError } from '@/server/infrastructure/nginxpilot'
import { parseProxy, parseUpstream, type Proxy, type Upstream } from '@/server/domain/routing'
import { slog } from '@/server/infrastructure/server-log'

/** A routing refusal Perch raises *before* touching nginxpilot (bad request shape). */
export class RoutingError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'RoutingError'
    }
}

/** The acting maintainer/owner, derived from the session — attributed on every audit entry. */
export interface RoutingActor {
    githubId: number
    login: string
}

function audit(actor: RoutingActor, action: string, detail: string): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, site: null, detail })
}

// ── upstreams ───────────────────────────────────────────────────────────────────

export async function listUpstreams(): Promise<Upstream[]> {
    return np.listUpstreams()
}

export async function createUpstream(actor: RoutingActor, input: unknown): Promise<Upstream> {
    const checked = parseUpstream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `upstream_${checked.reason}`, 400)

    await np.writeUpstream(checked.value)
    audit(actor, 'routing.upstream.create', checked.value.name)
    slog('info', 'routing', 'upstream written', { name: checked.value.name, by: actor.login })
    return checked.value
}

export async function deleteUpstream(actor: RoutingActor, name: unknown): Promise<void> {
    if (typeof name !== 'string' || !name.trim()) {
        throw new RoutingError('"name" is required', 'invalid_request', 400)
    }
    await np.removeUpstream(name.trim())
    audit(actor, 'routing.upstream.delete', name.trim())
    slog('info', 'routing', 'upstream removed', { name: name.trim(), by: actor.login })
}

// ── proxies ───────────────────────────────────────────────────────────────────

export async function listProxies(): Promise<Proxy[]> {
    return np.listProxies()
}

export async function createProxy(actor: RoutingActor, input: unknown): Promise<Proxy> {
    const checked = parseProxy(input)
    if (!checked.ok) throw new RoutingError(checked.message, `proxy_${checked.reason}`, 400)

    await np.writeProxy(checked.value)
    audit(actor, 'routing.proxy.create', checked.value.domain)
    slog('info', 'routing', 'proxy written', { domain: checked.value.domain, by: actor.login })
    return checked.value
}

export async function deleteProxy(actor: RoutingActor, domain: unknown): Promise<void> {
    if (typeof domain !== 'string' || !domain.trim()) {
        throw new RoutingError('"domain" is required', 'invalid_request', 400)
    }
    await np.removeProxy(domain.trim())
    audit(actor, 'routing.proxy.delete', domain.trim())
    slog('info', 'routing', 'proxy removed', { domain: domain.trim(), by: actor.login })
}

// ── error → HTTP mapping (so routes stay thin) ──────────────────────────────────

export interface HttpError {
    status: number
    code: string
}

/**
 * Map any error a routing operation can throw to its HTTP status + code. Our own
 * `RoutingError` carries its status; an `NginxpilotError` keeps the daemon's
 * meaning — a 400 (fragment rejected: bad shape / unknown upstream / duplicate
 * domain), a 409 (upstream still referenced by a proxy), a 404 — and anything else
 * is a 502 (the daemon is the upstream dependency here). Messages aren't forwarded.
 */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof RoutingError) return { status: err.status, code: err.code }
    if (err instanceof NginxpilotError) {
        switch (err.status) {
            case 400:
                return { status: 400, code: 'nginxpilot_rejected' }
            case 404:
                return { status: 404, code: 'not_found' }
            case 409:
                return { status: 409, code: 'in_use' }
            default:
                return { status: 502, code: 'nginxpilot_error' }
        }
    }
    return { status: 500, code: 'internal_error' }
}
