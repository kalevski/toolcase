// Pure domain layer for the reverse-proxy routing surface (nginxpilot `upstreams`
// and `proxies`). No `server-only`, no I/O — so the types are importable from
// client components AND the validation/rendering is unit-testable in isolation
// (mirrors `domain/nginxpilot-fragment.ts` for sites and `domain/admin.ts` for the
// plan-tier PUT body).
//
// Field names are snake_case to match nginxpilot's admin JSON/YAML 1:1 (the same
// convention `NginxpilotSiteStatus` follows): a `GET /upstreams` body deserializes
// straight into these types, and `render*Fragment` emits the exact YAML the
// `POST /upstreams` / `POST /proxies` admin endpoints parse. nginxpilot re-validates
// every fragment against its running config and is the final authority (a rejected
// fragment comes back as a 400); this layer front-runs that with the same rules so
// the UI gets fast, precise errors instead of an opaque daemon rejection.

// ── types (mirror nginxpilot/internal/config Upstream/Proxy JSON) ──────────────

/** nginx upstream load-balancing method. `''`/`round_robin` is the default. */
export type BalancerMethod = 'round_robin' | 'least_conn' | 'ip_hash'

/** One backend in an upstream pool. `address` is `host:port` or `unix:/path.sock`. */
export interface UpstreamServer {
    address: string
    weight?: number
    max_fails?: number
    fail_timeout?: string
    backup?: boolean
    down?: boolean
}

/** A named nginx `upstream{}` pool a proxy can `proxy_pass` to by name. */
export interface Upstream {
    name: string
    balancer?: BalancerMethod | ''
    keepalive?: number
    servers: UpstreamServer[]
}

/** A location → backend mapping, overriding the proxy default when set. */
export interface ProxyLocation {
    path: string
    upstream?: string
    pass?: string
    websocket?: boolean
}

/**
 * TLS termination mode for a managed-mode server block (§0). `off` is the default
 * (plain HTTP); `auto` serves HTTPS when a cert exists and degrades to HTTP otherwise;
 * `required` hard-fails the block until a cert is present. Shared by proxies, sites
 * (the `WebOptions` subset) and streams.
 */
export type TlsMode = 'off' | 'auto' | 'required'

/** Proxy response-cache config (a struct, not a bool — nginxpilot's `cache:` block). */
export interface ProxyCache {
    enabled: boolean
    /** `proxy_cache_valid` entries, e.g. `["200 10m", "404 1m"]`. */
    valid?: string[]
    /** `keys_zone` size, e.g. `10m`. */
    zone_size?: string
}

/**
 * nginxpilot's HSTS read shape — the daemon accepts a bare bool on write but its
 * admin API always serializes the struct form (`hsts: {}` when off), so a proxy
 * read back over `GET /proxies` carries an object here. Use {@link hstsEnabled}
 * instead of truthiness.
 */
export interface HstsOptions {
    enabled?: boolean
    max_age?: number
    include_subdomains?: boolean
    preload?: boolean
}

/** Effective HSTS state for either the bool write form or the struct read form. */
export function hstsEnabled(h: boolean | HstsOptions | undefined): boolean {
    if (typeof h === 'boolean') return h
    return h?.enabled === true
}

/** A reverse-proxy vhost: an nginx `server{}` block whose locations proxy_pass. */
export interface Proxy {
    domain: string
    /** `false` keeps the proxy configured but renders no nginx server block. Absent = enabled. */
    enabled?: boolean
    listen?: number
    upstream?: string
    pass?: string
    locations?: ProxyLocation[]
    connect_timeout?: string
    read_timeout?: string
    send_timeout?: string
    client_max_body_size?: string
    // ── TLS + security toggles (managed mode, §0/Phase B) ──
    tls?: TlsMode
    /** 80 → 301 https redirect. Requires `tls: auto|required`. */
    force_ssl?: boolean
    /** `http2 on;`. Requires `tls`. */
    http2?: boolean
    /** HSTS header. Written as a bool; read back as {@link HstsOptions}. Requires `tls`. */
    hsts?: boolean | HstsOptions
    block_exploits?: boolean
    /** Proxy-level upgrade headers on ALL locations (distinct from `ProxyLocation.websocket`). */
    websocket?: boolean
    gzip?: boolean
    cache?: ProxyCache
    /** Raw nginx passthrough; rides the daemon's `nginx -t` gate. */
    advanced?: string
}

// ── validation (the POST-body gate; mirrors internal/config/validate.go) ───────

/** nginxpilot's `upstreamNameRe` — a safe nginx identifier. */
const UPSTREAM_NAME = /^[A-Za-z0-9_]+$/
const BALANCERS: ReadonlySet<string> = new Set(['', 'round_robin', 'least_conn', 'ip_hash'])
const TLS_MODES: ReadonlySet<string> = new Set(['off', 'auto', 'required'])

/** Result of a parse/validate: the normalized entity, or a typed rejection. */
export type Check<T> = { ok: true; value: T } | { ok: false; reason: string; message: string }

const reject = <T>(reason: string, message: string): Check<T> => ({ ok: false, reason, message })

function asObject(input: unknown): Record<string, unknown> | null {
    return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null
}

/** A finite, non-negative integer (used for weight / max_fails / keepalive / listen). */
function optInt(value: unknown): { ok: true; value?: number } | { ok: false } {
    if (value === undefined || value === null || value === '') return { ok: true }
    const n = typeof value === 'string' ? Number(value) : value
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return { ok: false }
    return { ok: true, value: n }
}

/**
 * Validate + normalize an upstream (the `POST /api/routing/upstreams` body):
 * name matches `[A-Za-z0-9_]+`, balancer is a known method, keepalive ≥ 0, and
 * at least one server with a non-empty address and non-negative weight/max_fails.
 * Empty optionals are dropped so the rendered YAML stays minimal.
 */
export function parseUpstream(input: unknown): Check<Upstream> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'upstream must be an object')

    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) return reject('name_required', 'upstream name is required')
    if (!UPSTREAM_NAME.test(name)) return reject('bad_name', 'name must match [A-Za-z0-9_]+')

    const balancer = (o.balancer ?? '') as string
    if (!BALANCERS.has(balancer)) return reject('bad_balancer', 'balancer must be round_robin, least_conn or ip_hash')

    const keepalive = optInt(o.keepalive)
    if (!keepalive.ok) return reject('bad_keepalive', 'keepalive must be a non-negative integer')

    if (!Array.isArray(o.servers) || o.servers.length === 0) {
        return reject('no_servers', 'at least one server is required')
    }
    const servers: UpstreamServer[] = []
    for (const raw of o.servers) {
        const s = asObject(raw)
        if (!s) return reject('bad_server', 'each server must be an object')
        const address = typeof s.address === 'string' ? s.address.trim() : ''
        if (!address) return reject('address_required', 'every server needs an address')

        const weight = optInt(s.weight)
        if (!weight.ok) return reject('bad_weight', `server ${address}: weight must be a non-negative integer`)
        const maxFails = optInt(s.max_fails)
        if (!maxFails.ok) return reject('bad_max_fails', `server ${address}: max_fails must be a non-negative integer`)

        const server: UpstreamServer = { address }
        if (weight.value !== undefined) server.weight = weight.value
        if (maxFails.value !== undefined) server.max_fails = maxFails.value
        if (typeof s.fail_timeout === 'string' && s.fail_timeout.trim()) server.fail_timeout = s.fail_timeout.trim()
        if (s.backup === true) server.backup = true
        if (s.down === true) server.down = true
        servers.push(server)
    }

    const value: Upstream = { name, servers }
    if (balancer && balancer !== 'round_robin') value.balancer = balancer as BalancerMethod
    if (keepalive.value !== undefined && keepalive.value > 0) value.keepalive = keepalive.value
    return { ok: true, value }
}

/** Validate a single (upstream, pass) pair. `optional` allows neither (a proxy default locations override). */
function checkTarget(upstream: string, pass: string, optional: boolean): string | null {
    if (upstream && pass) return 'upstream and pass are mutually exclusive'
    if (pass && !/^https?:\/\//.test(pass)) return 'pass must be an http:// or https:// URL'
    if (!upstream && !pass && !optional) return 'upstream or pass is required'
    return null
}

/**
 * Validate + normalize a proxy (the `POST /api/routing/proxies` body): a non-empty
 * domain, an in-range listen port, exactly one of upstream/pass at the proxy level
 * (unless every location sets its own), and per-location paths that start with `/`
 * with their own exactly-one target. Upstream-name *existence* is the daemon's job
 * (it knows the running config); this only checks shape, then nginxpilot is the
 * final authority. Empty optionals are dropped.
 */
export function parseProxy(input: unknown): Check<Proxy> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'proxy must be an object')

    const domain = typeof o.domain === 'string' ? o.domain.trim().toLowerCase() : ''
    if (!domain) return reject('domain_required', 'proxy domain is required')
    if (domain.includes('*')) return reject('wildcard', 'wildcard domains are not supported')

    if (o.enabled !== undefined && o.enabled !== null && typeof o.enabled !== 'boolean') {
        return reject('bad_enabled', 'enabled must be a boolean')
    }

    const listen = optInt(o.listen)
    if (!listen.ok || (listen.value !== undefined && (listen.value < 1 || listen.value > 65535))) {
        return reject('bad_listen', 'listen must be a port in 1..65535')
    }

    const upstream = typeof o.upstream === 'string' ? o.upstream.trim() : ''
    const pass = typeof o.pass === 'string' ? o.pass.trim() : ''

    const rawLocations = Array.isArray(o.locations) ? o.locations : []
    const locations: ProxyLocation[] = []
    for (const raw of rawLocations) {
        const l = asObject(raw)
        if (!l) return reject('bad_location', 'each location must be an object')
        const path = typeof l.path === 'string' && l.path.trim() ? l.path.trim() : '/'
        if (!path.startsWith('/')) return reject('bad_path', `location path ${path} must start with /`)
        const lup = typeof l.upstream === 'string' ? l.upstream.trim() : ''
        const lpass = typeof l.pass === 'string' ? l.pass.trim() : ''
        // A location may inherit the proxy default; validate the effective pair.
        const eff = lup || lpass ? checkTarget(lup, lpass, false) : checkTarget(upstream, pass, false)
        if (eff) return reject('bad_target', `location ${path}: ${eff}`)
        const loc: ProxyLocation = { path }
        if (lup) loc.upstream = lup
        if (lpass) loc.pass = lpass
        if (l.websocket === true) loc.websocket = true
        locations.push(loc)
    }

    // The proxy default must itself be complete unless locations cover routing.
    const defaultErr = checkTarget(upstream, pass, locations.length > 0)
    if (defaultErr) return reject('bad_target', defaultErr)

    const value: Proxy = { domain }
    // Only the explicit disable is kept — absent/true both mean enabled (drop-defaults).
    if (o.enabled === false) value.enabled = false
    if (listen.value !== undefined && listen.value !== 80) value.listen = listen.value
    if (upstream) value.upstream = upstream
    if (pass) value.pass = pass
    if (locations.length) value.locations = locations
    for (const key of ['connect_timeout', 'read_timeout', 'send_timeout', 'client_max_body_size'] as const) {
        const v = o[key]
        if (typeof v === 'string' && v.trim()) value[key] = v.trim()
    }

    // ── TLS + security toggles (mirror nginxpilot's WebOptions validation, §0/Phase B) ──
    const tlsRaw = o.tls === undefined || o.tls === null || o.tls === '' ? 'off' : o.tls
    if (typeof tlsRaw !== 'string' || !TLS_MODES.has(tlsRaw)) {
        return reject('bad_tls', 'tls must be one of: off, auto, required')
    }
    const tls = tlsRaw as TlsMode
    const forceSsl = o.force_ssl === true
    const http2 = o.http2 === true
    // hsts arrives as a bool (our own UI) or the daemon's struct read-shape (a
    // proxy read back from GET /proxies and POSTed back for an edit/toggle).
    const hsts = o.hsts === true || asObject(o.hsts)?.enabled === true
    // force_ssl / http2 / hsts are meaningless without TLS — reject early so the user
    // sees it before the round-trip (nginxpilot enforces the same rule).
    if ((forceSsl || http2 || hsts) && tls === 'off') {
        return reject('tls_required', 'force_ssl, http2 and hsts require tls: auto or required')
    }

    let cache: ProxyCache | undefined
    if (o.cache !== undefined && o.cache !== null) {
        const c = asObject(o.cache)
        if (!c) return reject('bad_cache', 'cache must be an object')
        // The daemon's read API serializes a disabled cache as `cache: {}` (Go
        // omitempty drops `enabled: false`), so a missing enabled means disabled.
        if (c.enabled !== undefined && typeof c.enabled !== 'boolean') {
            return reject('bad_cache', 'cache.enabled must be a boolean')
        }
        if (c.valid !== undefined && c.valid !== null) {
            if (!Array.isArray(c.valid) || c.valid.some((v) => typeof v !== 'string')) {
                return reject('bad_cache', 'cache.valid must be an array of strings')
            }
        }
        // A disabled cache normalizes away entirely (drop-defaults); only an enabled
        // cache contributes to the fragment.
        if (c.enabled) {
            const cv: ProxyCache = { enabled: true }
            const valid = Array.isArray(c.valid) ? (c.valid as string[]).map((s) => s.trim()).filter(Boolean) : []
            if (valid.length) cv.valid = valid
            if (typeof c.zone_size === 'string' && c.zone_size.trim()) cv.zone_size = c.zone_size.trim()
            cache = cv
        }
    }

    const advanced = typeof o.advanced === 'string' && o.advanced.trim() ? o.advanced.trim() : undefined

    if (tls !== 'off') value.tls = tls
    if (forceSsl) value.force_ssl = true
    if (http2) value.http2 = true
    if (hsts) value.hsts = true
    if (o.block_exploits === true) value.block_exploits = true
    if (o.websocket === true) value.websocket = true
    if (o.gzip === true) value.gzip = true
    if (cache) value.cache = cache
    if (advanced) value.advanced = advanced

    return { ok: true, value }
}

// ── YAML rendering (the POST body; mirrors domain/nginxpilot-fragment.ts) ──────
//
// Hand-emit the fixed schema rather than pull in a YAML dependency. Plain-safe
// values are bare; anything else is double-quoted, which keeps the YAML valid and
// defuses injection through a value that slipped past validation.

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

/** Emit a YAML flow sequence, quoting each item only when needed: `[a, "b c"]`. */
function flowSeq(items: string[]): string {
    return `[${items.map(scalar).join(', ')}]`
}

/** Render the `upstreams: [ … ]` fragment for `POST /upstreams` (exactly one upstream). */
export function renderUpstreamFragment(u: Upstream): string {
    const lines: string[] = [
        '# generated by Perch; managed automatically, do not edit by hand.',
        'upstreams:',
        `  - name: ${scalar(u.name)}`,
    ]
    if (u.balancer) lines.push(`    balancer: ${scalar(u.balancer)}`)
    if (u.keepalive && u.keepalive > 0) lines.push(`    keepalive: ${u.keepalive}`)
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

/** Render the `proxies: [ … ]` fragment for `POST /proxies` (exactly one proxy). */
export function renderProxyFragment(p: Proxy): string {
    const lines: string[] = [
        '# generated by Perch; managed automatically, do not edit by hand.',
        'proxies:',
        `  - domain: ${scalar(p.domain)}`,
    ]
    if (p.enabled === false) lines.push('    enabled: false')
    if (p.listen) lines.push(`    listen: ${p.listen}`)
    if (p.upstream) lines.push(`    upstream: ${scalar(p.upstream)}`)
    if (p.pass) lines.push(`    pass: ${scalar(p.pass)}`)
    if (p.connect_timeout) lines.push(`    connect_timeout: ${scalar(p.connect_timeout)}`)
    if (p.read_timeout) lines.push(`    read_timeout: ${scalar(p.read_timeout)}`)
    if (p.send_timeout) lines.push(`    send_timeout: ${scalar(p.send_timeout)}`)
    if (p.client_max_body_size) lines.push(`    client_max_body_size: ${scalar(p.client_max_body_size)}`)
    // TLS + security toggles, in a deterministic order so the golden tests stay stable.
    if (p.tls) lines.push(`    tls: ${scalar(p.tls)}`)
    if (p.force_ssl) lines.push('    force_ssl: true')
    if (p.http2) lines.push('    http2: true')
    if (hstsEnabled(p.hsts)) lines.push('    hsts: true')
    if (p.block_exploits) lines.push('    block_exploits: true')
    if (p.websocket) lines.push('    websocket: true')
    if (p.gzip) lines.push('    gzip: true')
    if (p.cache) {
        lines.push('    cache:')
        lines.push(`      enabled: ${p.cache.enabled ? 'true' : 'false'}`)
        if (p.cache.valid && p.cache.valid.length) lines.push(`      valid: ${flowSeq(p.cache.valid)}`)
        if (p.cache.zone_size) lines.push(`      zone_size: ${scalar(p.cache.zone_size)}`)
    }
    if (p.advanced) {
        lines.push('    advanced: |')
        for (const line of p.advanced.split('\n')) lines.push(line ? `      ${line}` : '')
    }
    if (p.locations && p.locations.length) {
        lines.push('    locations:')
        for (const l of p.locations) {
            lines.push(`      - path: ${scalar(l.path)}`)
            if (l.upstream) lines.push(`        upstream: ${scalar(l.upstream)}`)
            if (l.pass) lines.push(`        pass: ${scalar(l.pass)}`)
            if (l.websocket) lines.push('        websocket: true')
        }
    }
    return lines.join('\n') + '\n'
}
