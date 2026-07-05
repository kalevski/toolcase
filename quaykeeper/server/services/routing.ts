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
import {
    NginxpilotError,
    type NginxManaged,
    type NginxpilotClient,
    type NginxTestResult,
    type WriteOptions,
} from '@/server/infrastructure/nginxpilot'
import {
    parseDeadHost,
    parseProxy,
    parseRedirect,
    parseUpstream,
    type DeadHost,
    type Proxy,
    type Redirect,
    type Upstream,
} from '@/server/domain/routing'
import { parseStream, parseStreamUpstream, type Stream, type StreamUpstream } from '@/server/domain/streams'
import { parseAccessList, type AccessList } from '@/server/domain/access-list'
import { slog } from '@/server/infrastructure/server-log'

/** A routing refusal Quaykeeper raises *before* touching nginxpilot (bad request shape). */
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

function audit(actor: RoutingActor, action: string, detail: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, site: null, detail, meta })
}

/**
 * A created/replaced routing entity plus the daemon's advisory target-check warnings
 * (A5). Warnings never block the write — the fragment is live; the route forwards
 * them so the UI can show a dismissible banner.
 */
export interface Created<T> {
    value: T
    warnings: string[]
}

/** Audit detail suffix flagging that the write carried target-check warnings. */
function warnSuffix(warnings: string[]): string {
    return warnings.length ? ` ⚠ ${warnings.length} warning(s)` : ''
}

// ── upstreams ───────────────────────────────────────────────────────────────────

export async function listUpstreams(client: NginxpilotClient): Promise<Upstream[]> {
    return client.listUpstreams()
}

export async function createUpstream(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
    opts?: WriteOptions,
): Promise<Created<Upstream>> {
    const checked = parseUpstream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `upstream_${checked.reason}`, 400)

    const { warnings } = await client.writeUpstream(checked.value, opts)
    audit(actor, 'routing.upstream.create', checked.value.name + warnSuffix(warnings), checked.value)
    slog('info', 'routing', 'upstream written', { name: checked.value.name, by: actor.login })
    return { value: checked.value, warnings }
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

export async function createProxy(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
    opts?: WriteOptions,
): Promise<Created<Proxy>> {
    const checked = parseProxy(input)
    if (!checked.ok) throw new RoutingError(checked.message, `proxy_${checked.reason}`, 400)

    const { warnings } = await client.writeProxy(checked.value, opts)
    audit(actor, 'routing.proxy.create', checked.value.domain + warnSuffix(warnings), checked.value)
    slog('info', 'routing', 'proxy written', { domain: checked.value.domain, by: actor.login })
    return { value: checked.value, warnings }
}

export async function deleteProxy(client: NginxpilotClient, actor: RoutingActor, domain: unknown): Promise<void> {
    if (typeof domain !== 'string' || !domain.trim()) {
        throw new RoutingError('"domain" is required', 'invalid_request', 400)
    }
    await client.removeProxy(domain.trim())
    audit(actor, 'routing.proxy.delete', domain.trim())
    slog('info', 'routing', 'proxy removed', { domain: domain.trim(), by: actor.login })
}

// ── redirects (30x redirection hosts) ───────────────────────────────────────────

export async function listRedirects(client: NginxpilotClient): Promise<Redirect[]> {
    return client.listRedirects()
}

export async function createRedirect(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
    opts?: WriteOptions,
): Promise<Created<Redirect>> {
    const checked = parseRedirect(input)
    if (!checked.ok) throw new RoutingError(checked.message, `redirect_${checked.reason}`, 400)

    const { warnings } = await client.writeRedirect(checked.value, opts)
    const r = checked.value
    audit(
        actor,
        'routing.redirect.create',
        `${r.domain} → ${r.to} (${r.code ?? 301}${r.scheme ? ` ${r.scheme}` : ''})` + warnSuffix(warnings),
        r,
    )
    slog('info', 'routing', 'redirect written', { domain: r.domain, to: r.to, by: actor.login })
    return { value: r, warnings }
}

export async function deleteRedirect(client: NginxpilotClient, actor: RoutingActor, domain: unknown): Promise<void> {
    if (typeof domain !== 'string' || !domain.trim()) {
        throw new RoutingError('"domain" is required', 'invalid_request', 400)
    }
    await client.removeRedirect(domain.trim())
    audit(actor, 'routing.redirect.delete', domain.trim())
    slog('info', 'routing', 'redirect removed', { domain: domain.trim(), by: actor.login })
}

// ── dead (parked) hosts ─────────────────────────────────────────────────────────

export async function listDeadHosts(client: NginxpilotClient): Promise<DeadHost[]> {
    return client.listDeadHosts()
}

export async function createDeadHost(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
    opts?: WriteOptions,
): Promise<Created<DeadHost>> {
    const checked = parseDeadHost(input)
    if (!checked.ok) throw new RoutingError(checked.message, `dead_host_${checked.reason}`, 400)

    const { warnings } = await client.writeDeadHost(checked.value, opts)
    const d = checked.value
    audit(actor, 'routing.dead_host.create', `${d.domain} (${d.code ?? 404})` + warnSuffix(warnings), d)
    slog('info', 'routing', 'dead host written', { domain: d.domain, by: actor.login })
    return { value: d, warnings }
}

export async function deleteDeadHost(client: NginxpilotClient, actor: RoutingActor, domain: unknown): Promise<void> {
    if (typeof domain !== 'string' || !domain.trim()) {
        throw new RoutingError('"domain" is required', 'invalid_request', 400)
    }
    await client.removeDeadHost(domain.trim())
    audit(actor, 'routing.dead_host.delete', domain.trim())
    slog('info', 'routing', 'dead host removed', { domain: domain.trim(), by: actor.login })
}

// ── access lists (C1 — IP allow/deny + basic auth policies) ─────────────────────

export async function listAccessLists(client: NginxpilotClient): Promise<AccessList[]> {
    return client.listAccessLists()
}

export async function createAccessList(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
): Promise<Created<AccessList>> {
    const checked = parseAccessList(input)
    if (!checked.ok) throw new RoutingError(checked.message, `access_list_${checked.reason}`, 400)

    const { warnings } = await client.writeAccessList(checked.value)
    const l = checked.value
    // Detail carries counts only — never password material (there is none here by construction).
    audit(
        actor,
        'routing.access_list.create',
        `${l.name} (${l.users?.length ?? 0} user(s), ${l.rules?.length ?? 0} rule(s), satisfy ${l.satisfy ?? 'all'})`,
        l,
    )
    slog('info', 'routing', 'access list written', { name: l.name, by: actor.login })
    return { value: l, warnings }
}

export async function deleteAccessList(client: NginxpilotClient, actor: RoutingActor, name: unknown): Promise<void> {
    if (typeof name !== 'string' || !name.trim()) {
        throw new RoutingError('"name" is required', 'invalid_request', 400)
    }
    await client.removeAccessList(name.trim())
    audit(actor, 'routing.access_list.delete', name.trim())
    slog('info', 'routing', 'access list removed', { name: name.trim(), by: actor.login })
}

/**
 * (Re)set one access-list user's password. The plaintext goes straight to the
 * daemon (which hashes it apr1 server-side) and NEVER into the audit log, the
 * slog stream, or an error message.
 */
export async function setAccessListPassword(
    client: NginxpilotClient,
    actor: RoutingActor,
    name: unknown,
    username: unknown,
    password: unknown,
): Promise<void> {
    if (typeof name !== 'string' || !name.trim()) {
        throw new RoutingError('"name" is required', 'invalid_request', 400)
    }
    if (typeof username !== 'string' || !username.trim()) {
        throw new RoutingError('"username" is required', 'invalid_request', 400)
    }
    if (typeof password !== 'string' || !password) {
        throw new RoutingError('"password" is required', 'invalid_request', 400)
    }
    if (password.length > 512) {
        throw new RoutingError('password is too long (max 512 chars)', 'invalid_request', 400)
    }
    await client.setAccessListPassword(name.trim(), username.trim(), password)
    audit(actor, 'routing.access_list.password', `${name.trim()}: ${username.trim()}`)
    slog('info', 'routing', 'access list password set', {
        name: name.trim(),
        username: username.trim(),
        by: actor.login,
    })
}

// ── stream upstreams (L4 pools) ─────────────────────────────────────────────────

export async function listStreamUpstreams(client: NginxpilotClient): Promise<StreamUpstream[]> {
    return client.listStreamUpstreams()
}

export async function createStreamUpstream(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
    opts?: WriteOptions,
): Promise<Created<StreamUpstream>> {
    const checked = parseStreamUpstream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `stream_upstream_${checked.reason}`, 400)

    const { warnings } = await client.writeStreamUpstream(checked.value, opts)
    audit(actor, 'routing.stream_upstream.create', checked.value.name + warnSuffix(warnings), checked.value)
    slog('info', 'routing', 'stream upstream written', { name: checked.value.name, by: actor.login })
    return { value: checked.value, warnings }
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

export async function createStream(
    client: NginxpilotClient,
    actor: RoutingActor,
    input: unknown,
    opts?: WriteOptions,
): Promise<Created<Stream>> {
    const checked = parseStream(input)
    if (!checked.ok) throw new RoutingError(checked.message, `stream_${checked.reason}`, 400)

    const { warnings } = await client.writeStream(checked.value, opts)
    audit(actor, 'routing.stream.create', checked.value.name + warnSuffix(warnings), checked.value)
    slog('info', 'routing', 'stream written', { name: checked.value.name, by: actor.login })
    return { value: checked.value, warnings }
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

/**
 * The managed-mode live resource states from `GET /status` (A7) — unlike the dry run
 * this carries the reconcile loop's `at_risk` overlay ("live but would fail the next
 * apply") plus the loop summary. Returns `null` when the daemon isn't managed (no
 * `nginx` block in the envelope), which the route surfaces as `managed: false`.
 */
export async function nginxStatus(client: NginxpilotClient): Promise<NginxManaged | null> {
    const status = await client.status()
    return status.nginx ?? null
}

// ── error → HTTP mapping (so routes stay thin) ──────────────────────────────────

export interface HttpError {
    status: number
    code: string
    /**
     * The daemon's operator-facing reason for a client-meaningful rejection (A5) —
     * "fragment rejected: unknown upstream …", `pass host "x" does not resolve (add
     * ?skip_target_checks=true to override)`. Sanitized + capped; only ever set for a
     * 4xx (never for a 5xx transport failure) and only from `NginxpilotError.detail`
     * or our own pre-flight `RoutingError` message — safe to forward to a maintainer.
     */
    detail?: string
}

/** Cap + de-control a daemon message so it's safe to embed in a JSON error body. */
function sanitizeDetail(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    const clean = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
    if (!clean) return undefined
    return clean.length > 500 ? `${clean.slice(0, 497)}…` : clean
}

/**
 * Map any error a routing operation can throw to its HTTP status + code. Our own
 * `RoutingError` carries its status; an `NginxpilotError` keeps the daemon's
 * meaning — a 400 (fragment rejected: bad shape / unknown upstream / duplicate
 * domain / unresolvable target), a 409 (an upstream still referenced by a proxy, or a
 * stream-upstream by a stream → `in_use`), a 404 — and anything else is a 502 (the
 * daemon is the upstream dependency here). For the 4xx family the daemon's
 * operator-facing reason is forwarded as `detail` so the browser can render an
 * actionable message (A5) — without it the DNS override hint never reaches the user.
 */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof RoutingError) {
        return { status: err.status, code: err.code, detail: sanitizeDetail(err.message) }
    }
    if (err instanceof NginxpilotError) {
        switch (err.status) {
            case 400:
                return { status: 400, code: 'nginxpilot_rejected', detail: sanitizeDetail(err.detail) }
            case 404:
                return { status: 404, code: 'not_found', detail: sanitizeDetail(err.detail) }
            case 409:
                return { status: 409, code: 'in_use', detail: sanitizeDetail(err.detail) }
            default:
                return { status: 502, code: 'nginxpilot_error' }
        }
    }
    return { status: 500, code: 'internal_error' }
}
