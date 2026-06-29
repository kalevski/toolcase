// Routing service (proxies + upstreams) — the policy layer the `/api/routing/**`
// routes call, all reached only after `authorize('maintainer')` (so owners *and*
// maintainers, but never a standard user). It is the maintainer counterpart to the
// owner-only `services/admin.ts`: validate the request with the pure
// `domain/routing.ts` rules, drive nginxpilot's admin API, and audit every mutation.
//
// Multiple-realms (multiple_realms.md §E.2): routing entities live INSIDE one
// nginxpilot, so they're per-realm automatically — every op runs against the
// **active-realm client** the route resolves and passes in. nginxpilot is the final
// authority — it re-validates each fragment against its running config (unknown
// upstream reference, duplicate domain, an upstream still in use on delete) and
// answers with a precise status. `httpErrorFor` maps both our own pre-flight
// `RoutingError` and a daemon `NginxpilotError` onto a route-ready status + code.

import 'server-only'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { NginxpilotError, type NginxpilotClient, type NginxTestResult } from '@/server/infrastructure/nginxpilot'
import { parseProxy, parseUpstream, type Proxy, type Upstream } from '@/server/domain/routing'
import { parseStream, parseStreamUpstream, type Stream, type StreamUpstream } from '@/server/domain/streams'
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

export async function listUpstreams(client: NginxpilotClient): Promise<Upstream[]> {
    return client.listUpstreams()
}

export async function createUpstream(client: NginxpilotClient, actor: RoutingActor, input: unknown): Promise<Upstream> {
    const checked = parseUpstream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `upstream_${checked.reason}`, 400)

    await client.writeUpstream(checked.value)
    audit(actor, 'routing.upstream.create', checked.value.name)
    slog('info', 'routing', 'upstream written', { name: checked.value.name, by: actor.login })
    return checked.value
}

export async function deleteUpstream(client: NginxpilotClient, actor: RoutingActor, name: unknown): Promise<void> {
    if (typeof name !== 'string' || !name.trim()) {
        throw new RoutingError('"name" is required', 'invalid_request', 400)
    }
    await client.removeUpstream(name.trim())
    audit(actor, 'routing.upstream.delete', name.trim())
    slog('info', 'routing', 'upstream removed', { name: name.trim(), by: actor.login })
}

// ── proxies ───────────────────────────────────────────────────────────────────

export async function listProxies(client: NginxpilotClient): Promise<Proxy[]> {
    return client.listProxies()
}

export async function createProxy(client: NginxpilotClient, actor: RoutingActor, input: unknown): Promise<Proxy> {
    const checked = parseProxy(input)
    if (!checked.ok) throw new RoutingError(checked.message, `proxy_${checked.reason}`, 400)

    await client.writeProxy(checked.value)
    audit(actor, 'routing.proxy.create', checked.value.domain)
    slog('info', 'routing', 'proxy written', { domain: checked.value.domain, by: actor.login })
    return checked.value
}

export async function deleteProxy(client: NginxpilotClient, actor: RoutingActor, domain: unknown): Promise<void> {
    if (typeof domain !== 'string' || !domain.trim()) {
        throw new RoutingError('"domain" is required', 'invalid_request', 400)
    }
    await client.removeProxy(domain.trim())
    audit(actor, 'routing.proxy.delete', domain.trim())
    slog('info', 'routing', 'proxy removed', { domain: domain.trim(), by: actor.login })
}

// ── stream upstreams (L4 pools) ─────────────────────────────────────────────────

export async function listStreamUpstreams(client: NginxpilotClient): Promise<StreamUpstream[]> {
    return client.listStreamUpstreams()
}

export async function createStreamUpstream(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
): Promise<StreamUpstream> {
    const checked = parseStreamUpstream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `stream_upstream_${checked.reason}`, 400)

    await client.writeStreamUpstream(checked.value)
    audit(actor, 'routing.stream_upstream.create', checked.value.name)
    slog('info', 'routing', 'stream upstream written', { name: checked.value.name, by: actor.login })
    return checked.value
}

export async function deleteStreamUpstream(
    client: NginxpilotClient,
    actor: RoutingActor,
    name: unknown,
): Promise<void> {
    if (typeof name !== 'string' || !name.trim()) {
        throw new RoutingError('"name" is required', 'invalid_request', 400)
    }
    await client.removeStreamUpstream(name.trim())
    audit(actor, 'routing.stream_upstream.delete', name.trim())
    slog('info', 'routing', 'stream upstream removed', { name: name.trim(), by: actor.login })
}

// ── streams (L4 TCP/UDP listeners) ──────────────────────────────────────────────

export async function listStreams(client: NginxpilotClient): Promise<Stream[]> {
    return client.listStreams()
}

export async function createStream(client: NginxpilotClient, actor: RoutingActor, input: unknown): Promise<Stream> {
    const checked = parseStream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `stream_${checked.reason}`, 400)

    await client.writeStream(checked.value)
    audit(actor, 'routing.stream.create', checked.value.name)
    slog('info', 'routing', 'stream written', { name: checked.value.name, by: actor.login })
    return checked.value
}

export async function deleteStream(client: NginxpilotClient, actor: RoutingActor, name: unknown): Promise<void> {
    if (typeof name !== 'string' || !name.trim()) {
        throw new RoutingError('"name" is required', 'invalid_request', 400)
    }
    await client.removeStream(name.trim())
    audit(actor, 'routing.stream.delete', name.trim())
    slog('info', 'routing', 'stream removed', { name: name.trim(), by: actor.login })
}

// ── managed-mode dry run (Phase E) ──────────────────────────────────────────────

/**
 * Managed-mode dry run (`POST /nginx/test`) against the active realm — preview the
 * per-resource pass/fail set the daemon would apply, without committing it. Returns `null`
 * when managed mode is off (the daemon answers 501), which the route surfaces as "managed
 * mode off".
 */
export async function nginxTest(client: NginxpilotClient): Promise<NginxTestResult | null> {
    return client.nginxTest()
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
 * domain), a 409 (an upstream still referenced by a proxy, or a stream-upstream by a
 * stream → `in_use`), a 404 — and anything else
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
