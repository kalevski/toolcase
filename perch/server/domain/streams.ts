// Pure domain layer for the L4 stream routing surface (nginxpilot `streams` and
// `stream_upstreams`) — the TCP/UDP counterpart to `domain/routing.ts`'s http
// proxies/upstreams. No `server-only`, no I/O: the types import from client
// components AND the validation/rendering is unit-testable in isolation.
//
// Field names are snake_case to match nginxpilot's admin JSON/YAML 1:1 (a
// `GET /streams` body deserializes straight into these types; `render*Fragment`
// emits the exact YAML the `POST /streams` / `POST /stream-upstreams` endpoints parse).
// nginxpilot re-validates every fragment against its running config and is the final
// authority; this front-runs that with the same rules so the UI gets fast, precise
// errors.
//
// Two stream-specific facts that differ from http (§1): the balancer set uses `hash`
// (NOT `ip_hash`); a stream `pass` is a bare `host:port` (NOT an http URL); and the
// stream + http upstream namespaces are SEPARATE (the same name in both is fine).

import type { Check } from './routing'

// ── types (mirror nginxpilot/internal/config Stream/StreamUpstream JSON) ────────

/** L4 load-balancing method. `''`/`round_robin` is the default. NB: `hash`, not `ip_hash`. */
export type StreamBalancer = 'round_robin' | 'least_conn' | 'hash'

/** TLS termination for an L4 listener. `auto`/`required` need a `tls_domain` (no SNI at L4). */
export type StreamTlsMode = 'off' | 'auto' | 'required'

/** One backend in a stream upstream pool. `address` is `host:port` or `unix:/path.sock`. */
export interface StreamServer {
    address: string
    weight?: number
    max_fails?: number
    fail_timeout?: string
    backup?: boolean
    down?: boolean
}

/** A named `stream { upstream {} }` pool a stream can route to by name. No `keepalive`. */
export interface StreamUpstream {
    name: string
    balancer?: StreamBalancer | ''
    servers: StreamServer[]
}

/** An L4 `server {}` listener: a TCP/UDP port forwarded to a pool or an inline `host:port`. */
export interface Stream {
    /** Identity key (L4 has no Host) — `[A-Za-z0-9_]+`. */
    name: string
    /** Listen port, 1..65535. */
    listen: number
    /** `tcp` (default) | `udp`. */
    protocol?: 'tcp' | 'udp'
    /** XOR `pass` — a named stream upstream. */
    upstream?: string
    /** XOR `upstream` — a bare `host:port` target (NOT an http URL). */
    pass?: string
    proxy_protocol?: boolean
    connect_timeout?: string
    /** → `proxy_timeout`. */
    timeout?: string
    tls?: StreamTlsMode
    /** Required when `tls` is `auto|required` (no SNI at L4). */
    tls_domain?: string
}

// ── validation (the POST-body gate; mirrors internal/config/validate.go) ────────

const STREAM_NAME = /^[A-Za-z0-9_]+$/
const BALANCERS: ReadonlySet<string> = new Set(['', 'round_robin', 'least_conn', 'hash'])
const TLS_MODES: ReadonlySet<string> = new Set(['off', 'auto', 'required'])
const PROTOCOLS: ReadonlySet<string> = new Set(['tcp', 'udp'])

const reject = <T>(reason: string, message: string): Check<T> => ({ ok: false, reason, message })

function asObject(input: unknown): Record<string, unknown> | null {
    return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null
}

/** A finite, non-negative integer (weight / max_fails / listen). */
function optInt(value: unknown): { ok: true; value?: number } | { ok: false } {
    if (value === undefined || value === null || value === '') return { ok: true }
    const n = typeof value === 'string' ? Number(value) : value
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return { ok: false }
    return { ok: true, value: n }
}

/**
 * Validate + normalize a stream upstream (the `POST /api/routing/stream-upstreams`
 * body): name matches `[A-Za-z0-9_]+`, balancer is a known method (`hash`, not
 * `ip_hash`), and at least one server with a non-empty address. Empty optionals and
 * the `round_robin` default are dropped so the rendered YAML stays minimal. There is
 * deliberately no `keepalive` for stream upstreams.
 */
export function parseStreamUpstream(input: unknown): Check<StreamUpstream> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'stream upstream must be an object')

    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) return reject('name_required', 'stream upstream name is required')
    if (!STREAM_NAME.test(name)) return reject('bad_name', 'name must match [A-Za-z0-9_]+')

    const balancer = (o.balancer ?? '') as string
    if (!BALANCERS.has(balancer)) return reject('bad_balancer', 'balancer must be round_robin, least_conn or hash')

    if (!Array.isArray(o.servers) || o.servers.length === 0) {
        return reject('no_servers', 'at least one server is required')
    }
    const servers: StreamServer[] = []
    for (const raw of o.servers) {
        const s = asObject(raw)
        if (!s) return reject('bad_server', 'each server must be an object')
        const address = typeof s.address === 'string' ? s.address.trim() : ''
        if (!address) return reject('address_required', 'every server needs an address')

        const weight = optInt(s.weight)
        if (!weight.ok) return reject('bad_weight', `server ${address}: weight must be a non-negative integer`)
        const maxFails = optInt(s.max_fails)
        if (!maxFails.ok) return reject('bad_max_fails', `server ${address}: max_fails must be a non-negative integer`)

        const server: StreamServer = { address }
        if (weight.value !== undefined) server.weight = weight.value
        if (maxFails.value !== undefined) server.max_fails = maxFails.value
        if (typeof s.fail_timeout === 'string' && s.fail_timeout.trim()) server.fail_timeout = s.fail_timeout.trim()
        if (s.backup === true) server.backup = true
        if (s.down === true) server.down = true
        servers.push(server)
    }

    const value: StreamUpstream = { name, servers }
    if (balancer && balancer !== 'round_robin') value.balancer = balancer as StreamBalancer
    return { ok: true, value }
}

// A stream `pass` is a bare host:port (not an http URL): reject a scheme, require a
// numeric port. Conservative — nginxpilot is the final authority on host shape.
const HOST_PORT = /^\S+:\d+$/

/**
 * Validate + normalize a stream (the `POST /api/routing/streams` body): a name matching
 * `[A-Za-z0-9_]+`, an in-range listen port, a tcp|udp protocol, exactly one of
 * upstream/pass (pass a bare `host:port`), and a `tls_domain` whenever TLS is
 * `auto|required` (no SNI at L4). Upstream-name *existence* is the daemon's job; this
 * only checks shape. Empty optionals and the tcp/off defaults are dropped.
 */
export function parseStream(input: unknown): Check<Stream> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'stream must be an object')

    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) return reject('name_required', 'stream name is required')
    if (!STREAM_NAME.test(name)) return reject('bad_name', 'name must match [A-Za-z0-9_]+')

    const listen = optInt(o.listen)
    if (!listen.ok || listen.value === undefined) return reject('bad_listen', 'listen must be a port in 1..65535')
    if (listen.value < 1 || listen.value > 65535) return reject('bad_listen', 'listen must be a port in 1..65535')

    const protocolRaw = o.protocol === undefined || o.protocol === null || o.protocol === '' ? 'tcp' : o.protocol
    if (typeof protocolRaw !== 'string' || !PROTOCOLS.has(protocolRaw)) {
        return reject('bad_protocol', 'protocol must be tcp or udp')
    }
    const protocol = protocolRaw as 'tcp' | 'udp'

    const upstream = typeof o.upstream === 'string' ? o.upstream.trim() : ''
    const pass = typeof o.pass === 'string' ? o.pass.trim() : ''
    if (upstream && pass) return reject('bad_target', 'upstream and pass are mutually exclusive')
    if (!upstream && !pass) return reject('bad_target', 'upstream or pass is required')
    if (pass && (pass.includes('://') || !HOST_PORT.test(pass))) {
        return reject('bad_pass', 'pass must be a host:port (not a URL)')
    }

    const tlsRaw = o.tls === undefined || o.tls === null || o.tls === '' ? 'off' : o.tls
    if (typeof tlsRaw !== 'string' || !TLS_MODES.has(tlsRaw)) {
        return reject('bad_tls', 'tls must be one of: off, auto, required')
    }
    const tls = tlsRaw as StreamTlsMode
    const tlsDomain = typeof o.tls_domain === 'string' ? o.tls_domain.trim() : ''
    if (tls !== 'off' && !tlsDomain) {
        return reject('tls_domain_required', 'tls_domain is required when tls is auto or required (no SNI at L4)')
    }

    const value: Stream = { name, listen: listen.value }
    if (protocol !== 'tcp') value.protocol = protocol
    if (upstream) value.upstream = upstream
    if (pass) value.pass = pass
    if (o.proxy_protocol === true) value.proxy_protocol = true
    if (typeof o.connect_timeout === 'string' && o.connect_timeout.trim()) value.connect_timeout = o.connect_timeout.trim()
    if (typeof o.timeout === 'string' && o.timeout.trim()) value.timeout = o.timeout.trim()
    if (tls !== 'off') {
        value.tls = tls
        value.tls_domain = tlsDomain
    }
    return { ok: true, value }
}

// ── YAML rendering (the POST body; mirrors domain/routing.ts) ───────────────────

const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/

function quote(value: string): string {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
    return `"${escaped}"`
}

function scalar(value: string): string {
    return PLAIN_SCALAR.test(value) ? value : quote(value)
}

/** Render the `stream_upstreams: [ … ]` fragment for `POST /stream-upstreams` (exactly one). */
export function renderStreamUpstreamFragment(u: StreamUpstream): string {
    const lines: string[] = [
        '# generated by Perch; managed automatically, do not edit by hand.',
        'stream_upstreams:',
        `  - name: ${scalar(u.name)}`,
    ]
    if (u.balancer) lines.push(`    balancer: ${scalar(u.balancer)}`)
    lines.push('    servers:')
    for (const s of u.servers) {
        lines.push(`      - address: ${scalar(s.address)}`)
        if (s.weight !== undefined) lines.push(`        weight: ${s.weight}`)
        if (s.max_fails !== undefined) lines.push(`        max_fails: ${s.max_fails}`)
        if (s.fail_timeout) lines.push(`        fail_timeout: ${scalar(s.fail_timeout)}`)
        if (s.backup) lines.push('        backup: true')
        if (s.down) lines.push('        down: true')
    }
    return lines.join('\n') + '\n'
}

/** Render the `streams: [ … ]` fragment for `POST /streams` (exactly one stream). */
export function renderStreamFragment(s: Stream): string {
    const lines: string[] = [
        '# generated by Perch; managed automatically, do not edit by hand.',
        'streams:',
        `  - name: ${scalar(s.name)}`,
        `    listen: ${s.listen}`,
    ]
    if (s.protocol) lines.push(`    protocol: ${scalar(s.protocol)}`)
    if (s.upstream) lines.push(`    upstream: ${scalar(s.upstream)}`)
    if (s.pass) lines.push(`    pass: ${scalar(s.pass)}`)
    if (s.proxy_protocol) lines.push('    proxy_protocol: true')
    if (s.connect_timeout) lines.push(`    connect_timeout: ${scalar(s.connect_timeout)}`)
    if (s.timeout) lines.push(`    timeout: ${scalar(s.timeout)}`)
    if (s.tls) lines.push(`    tls: ${scalar(s.tls)}`)
    if (s.tls_domain) lines.push(`    tls_domain: ${scalar(s.tls_domain)}`)
    return lines.join('\n') + '\n'
}
