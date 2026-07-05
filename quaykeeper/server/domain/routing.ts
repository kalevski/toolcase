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
    /** Raw nginx passthrough inside this one location block; rides the daemon's `nginx -t` gate. */
    advanced?: string
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

/**
 * Validate + normalize the HSTS field, mirroring the daemon's bool-or-mapping
 * contract (config.HSTS.UnmarshalYAML): absent / `false` / `{}` / `{enabled:false}`
 * → undefined (off); `true` or an all-defaults struct → `true` (minimal write form);
 * a struct with custom options → HstsOptions carrying only the non-default fields
 * (daemon defaults: max_age 0 → 2 years, include_subdomains absent → true).
 */
function parseHsts(raw: unknown): Check<true | HstsOptions | undefined> {
    if (raw === undefined || raw === null || raw === false) return { ok: true, value: undefined }
    if (raw === true) return { ok: true, value: true }
    const o = asObject(raw)
    if (!o) {
        return reject('bad_hsts', 'hsts must be a boolean or a {max_age, include_subdomains, preload} object')
    }
    // The daemon's read API serializes `hsts: {}` when off (Go omitempty) — only an
    // explicit enabled: true is on.
    if (o.enabled !== true) return { ok: true, value: undefined }
    if (o.max_age !== undefined && (!Number.isInteger(o.max_age) || (o.max_age as number) < 0)) {
        return reject('bad_hsts', 'hsts.max_age must be a non-negative integer (seconds)')
    }
    if (o.include_subdomains !== undefined && typeof o.include_subdomains !== 'boolean') {
        return reject('bad_hsts', 'hsts.include_subdomains must be a boolean')
    }
    if (o.preload !== undefined && typeof o.preload !== 'boolean') {
        return reject('bad_hsts', 'hsts.preload must be a boolean')
    }
    const value: HstsOptions = { enabled: true }
    if (typeof o.max_age === 'number' && o.max_age > 0) value.max_age = o.max_age
    if (o.include_subdomains === false) value.include_subdomains = false
    if (o.preload === true) value.preload = true
    // An all-defaults struct collapses to the minimal bool write form.
    if (value.max_age === undefined && value.include_subdomains === undefined && !value.preload) {
        return { ok: true, value: true }
    }
    return { ok: true, value }
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
    /** HSTS header. Bool for defaults or {@link HstsOptions} for custom max-age/subdomains/preload. Requires `tls`. */
    hsts?: boolean | HstsOptions
    block_exploits?: boolean
    /** Proxy-level upgrade headers on ALL locations (distinct from `ProxyLocation.websocket`). */
    websocket?: boolean
    gzip?: boolean
    cache?: ProxyCache
    /** Raw nginx passthrough; rides the daemon's `nginx -t` gate. */
    advanced?: string
    /** Named access list guarding this vhost (C1); unknown names are a daemon 400. */
    access_list?: string
}

// ── redirects + dead hosts (better.md §3 — lightweight http vhosts) ─────────────

/** Redirect target scheme. `auto` (the default) emits `$scheme` — preserve http/https. */
export type RedirectScheme = 'auto' | 'http' | 'https'

/** Redirect status codes the daemon accepts (301 is the default). */
export type RedirectCode = 301 | 302 | 303 | 307 | 308

/** Parked-domain status codes the daemon accepts (404 default; 444 closes the connection). */
export type DeadHostCode = 404 | 410 | 444 | 503

/**
 * A redirection host: an nginx `server{}` block answering every request with a
 * configurable 30x to another host. Carries the WebOptions subset **minus
 * `force_ssl`** — the daemon rejects it on redirects (the redirect IS the redirect;
 * `tls: auto|required` makes it answer https too), and {@link parseRedirect} mirrors
 * that rejection so the user never round-trips for it.
 */
export interface Redirect {
    domain: string
    /** `false` keeps the redirect configured but renders no nginx server block. Absent = enabled. */
    enabled?: boolean
    listen?: number
    /** Target host — no scheme, optional `:port`. */
    to: string
    /** Target scheme; absent = `auto` (`$scheme`). */
    scheme?: RedirectScheme
    /** Redirect status; absent = 301. */
    code?: RedirectCode
    /** Append `$request_uri` to the target. Absent = true (the daemon default). */
    preserve_path?: boolean
    tls?: TlsMode
    /** `http2 on;`. Requires `tls`. */
    http2?: boolean
    /** HSTS header. Bool for defaults or {@link HstsOptions} for custom max-age/subdomains/preload. Requires `tls`. */
    hsts?: boolean | HstsOptions
    block_exploits?: boolean
    gzip?: boolean
    /** Raw nginx passthrough; rides the daemon's `nginx -t` gate. */
    advanced?: string
    /** Named access list guarding this redirect (C1). */
    access_list?: string
}

/**
 * A dead (parked) host: nginx answers every request with a fixed error code,
 * optionally over TLS — keeping the cert warm while a service is retired. Unlike
 * {@link Redirect} this DOES allow `force_ssl` (an https-only parked domain that
 * 301s plain HTTP up first is legitimate).
 */
export interface DeadHost {
    domain: string
    /** `false` keeps the dead host configured but renders no nginx server block. Absent = enabled. */
    enabled?: boolean
    listen?: number
    /** Parked status; absent = 404. 444 closes the connection without a response. */
    code?: DeadHostCode
    tls?: TlsMode
    /** 80 → 301 https redirect. Requires `tls: auto|required`. */
    force_ssl?: boolean
    /** `http2 on;`. Requires `tls`. */
    http2?: boolean
    /** HSTS header. Bool for defaults or {@link HstsOptions} for custom max-age/subdomains/preload. Requires `tls`. */
    hsts?: boolean | HstsOptions
    block_exploits?: boolean
    gzip?: boolean
    /** Raw nginx passthrough; rides the daemon's `nginx -t` gate. */
    advanced?: string
    /** Named access list guarding this dead host (C1). */
    access_list?: string
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

    // Wildcards follow the daemon's rule (A3): exactly one leading `*.` label is
    // accepted; any other `*` placement is rejected. Sites stay strict — this is
    // proxy/redirect/dead-host-only.
    const checkedDomain = checkRoutingDomain(o.domain, 'proxy')
    if (!checkedDomain.ok) return checkedDomain
    const domain = checkedDomain.value

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
        // Per-location raw nginx passthrough (A4) — same escape hatch as the
        // server-level `advanced`, scoped to this one location block.
        if (typeof l.advanced === 'string' && l.advanced.trim()) loc.advanced = l.advanced.trim()
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
    // proxy read back from GET /proxies and POSTed back for an edit/toggle);
    // custom options (max_age / include_subdomains / preload) round-trip.
    const hstsCheck = parseHsts(o.hsts)
    if (!hstsCheck.ok) return hstsCheck
    const hsts = hstsCheck.value
    // force_ssl / http2 / hsts are meaningless without TLS — reject early so the user
    // sees it before the round-trip (nginxpilot enforces the same rule).
    if ((forceSsl || http2 || hsts !== undefined) && tls === 'off') {
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

    const accessList = checkAccessListRef(o.access_list)
    if (!accessList.ok) return accessList

    if (tls !== 'off') value.tls = tls
    if (forceSsl) value.force_ssl = true
    if (http2) value.http2 = true
    if (hsts !== undefined) value.hsts = hsts
    if (o.block_exploits === true) value.block_exploits = true
    if (o.websocket === true) value.websocket = true
    if (o.gzip === true) value.gzip = true
    if (cache) value.cache = cache
    if (advanced) value.advanced = advanced
    if (accessList.value) value.access_list = accessList.value

    return { ok: true, value }
}

// ── redirect + dead-host validation ────────────────────────────────────────────

const REDIRECT_CODES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308])
const DEAD_HOST_CODES: ReadonlySet<number> = new Set([404, 410, 444, 503])
const REDIRECT_SCHEMES: ReadonlySet<string> = new Set(['auto', 'http', 'https'])

/**
 * Trim/lowercase a routing domain and enforce the daemon's wildcard rule: exactly one
 * leading `*.` label is accepted (proxies/redirects/dead-hosts), any other `*` is
 * rejected. Charset/IDNA normalization stays the daemon's job — this only front-runs
 * the shape rules that would otherwise round-trip as an opaque 400.
 */
function checkRoutingDomain(raw: unknown, what: string): Check<string> {
    const domain = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if (!domain) return reject('domain_required', `${what} domain is required`)
    if (domain.startsWith('*.')) {
        const base = domain.slice(2)
        if (!base) return reject('bad_wildcard', 'wildcard domain needs a base ("*.example.com")')
        if (base.includes('*')) return reject('bad_wildcard', 'only one leading "*." label is supported')
        return { ok: true, value: domain }
    }
    if (domain.includes('*')) {
        return reject('bad_wildcard', 'wildcards are only supported as one leading "*." label')
    }
    return { ok: true, value: domain }
}

const ACCESS_LIST_NAME = /^[A-Za-z0-9_]+$/

/**
 * Validate an optional `access_list` reference (C1): absent/empty is fine
 * (open), a set value must be a safe identifier. Whether the name EXISTS is the
 * daemon's call — it knows the running config.
 */
function checkAccessListRef(raw: unknown): Check<string | undefined> {
    if (raw === undefined || raw === null || raw === '') return { ok: true, value: undefined }
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!name || !ACCESS_LIST_NAME.test(name)) {
        return reject('bad_access_list', 'access_list must be an access-list name ([A-Za-z0-9_]+)')
    }
    return { ok: true, value: name }
}

/** The normalized web-toggle subset shared by redirects and dead hosts. */
interface WebToggles {
    tls?: TlsMode
    force_ssl?: boolean
    http2?: boolean
    hsts?: boolean | HstsOptions
    block_exploits?: boolean
    gzip?: boolean
    advanced?: string
}

/**
 * Validate + normalize the WebOptions toggle subset (tls / force_ssl / http2 / hsts /
 * block_exploits / gzip / advanced) shared by redirects and dead hosts, mirroring the
 * daemon's `validateWebOptions`. `allowForceSsl: false` mirrors the redirect-specific
 * rejection (reason `force_ssl_on_redirect`) so the user never round-trips for it.
 */
function parseWebToggles(o: Record<string, unknown>, allowForceSsl: boolean): Check<WebToggles> {
    const tlsRaw = o.tls === undefined || o.tls === null || o.tls === '' ? 'off' : o.tls
    if (typeof tlsRaw !== 'string' || !TLS_MODES.has(tlsRaw)) {
        return reject('bad_tls', 'tls must be one of: off, auto, required')
    }
    const tls = tlsRaw as TlsMode
    const forceSsl = o.force_ssl === true
    if (forceSsl && !allowForceSsl) {
        return reject(
            'force_ssl_on_redirect',
            'force_ssl is not supported on a redirect — the redirect IS the redirect; use tls: auto or required to also answer https',
        )
    }
    const http2 = o.http2 === true
    // hsts arrives as a bool (our own UI) or the daemon's struct read-shape;
    // custom options round-trip.
    const hstsCheck = parseHsts(o.hsts)
    if (!hstsCheck.ok) return hstsCheck
    const hsts = hstsCheck.value
    if ((forceSsl || http2 || hsts !== undefined) && tls === 'off') {
        return reject('tls_required', 'force_ssl, http2 and hsts require tls: auto or required')
    }

    const value: WebToggles = {}
    if (tls !== 'off') value.tls = tls
    if (forceSsl) value.force_ssl = true
    if (http2) value.http2 = true
    if (hsts !== undefined) value.hsts = hsts
    if (o.block_exploits === true) value.block_exploits = true
    if (o.gzip === true) value.gzip = true
    if (typeof o.advanced === 'string' && o.advanced.trim()) value.advanced = o.advanced.trim()
    return { ok: true, value }
}

/**
 * Validate + normalize a redirect (the `POST /api/routing/redirects` body),
 * front-running the daemon's rules: a required host-shaped `to` (optional `:port`,
 * no scheme), the code/scheme enums, the blunt self-redirect rejection (`to` host
 * equals `domain`, any port — with the auto-scheme + preserve-path defaults ANY
 * same-host redirect is an infinite loop), and `force_ssl` rejected outright.
 * Defaults are dropped (code 301, scheme auto, preserve_path true) so the rendered
 * YAML stays minimal.
 */
export function parseRedirect(input: unknown): Check<Redirect> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'redirect must be an object')

    const domain = checkRoutingDomain(o.domain, 'redirect')
    if (!domain.ok) return domain

    if (o.enabled !== undefined && o.enabled !== null && typeof o.enabled !== 'boolean') {
        return reject('bad_enabled', 'enabled must be a boolean')
    }

    const listen = optInt(o.listen)
    if (!listen.ok || (listen.value !== undefined && (listen.value < 1 || listen.value > 65535))) {
        return reject('bad_listen', 'listen must be a port in 1..65535')
    }

    // `to` — the target host: no scheme, no path, an optional :port.
    const toRaw = typeof o.to === 'string' ? o.to.trim().toLowerCase() : ''
    if (!toRaw) return reject('to_required', 'to (the target host) is required')
    if (toRaw.includes('://') || toRaw.includes('/')) {
        return reject('bad_to', 'to must be a bare host (optionally :port) — no scheme or path')
    }
    let toHost = toRaw
    const colon = toRaw.lastIndexOf(':')
    if (colon >= 0) {
        toHost = toRaw.slice(0, colon)
        const port = Number(toRaw.slice(colon + 1))
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            return reject('bad_to', 'to port must be 1..65535')
        }
    }
    if (!toHost) return reject('bad_to', 'to needs a host before the :port')
    if (toHost === domain.value) {
        return reject('self_redirect', `${toRaw} redirects to itself — use a proxy, or a different host`)
    }

    const codeInt = optInt(o.code)
    if (!codeInt.ok || (codeInt.value !== undefined && !REDIRECT_CODES.has(codeInt.value))) {
        return reject('bad_code', 'code must be 301, 302, 303, 307 or 308')
    }
    const scheme = o.scheme === undefined || o.scheme === null || o.scheme === '' ? 'auto' : o.scheme
    if (typeof scheme !== 'string' || !REDIRECT_SCHEMES.has(scheme)) {
        return reject('bad_scheme', 'scheme must be http, https or auto')
    }
    if (o.preserve_path !== undefined && o.preserve_path !== null && typeof o.preserve_path !== 'boolean') {
        return reject('bad_preserve_path', 'preserve_path must be a boolean')
    }

    const toggles = parseWebToggles(o, false)
    if (!toggles.ok) return toggles
    const accessList = checkAccessListRef(o.access_list)
    if (!accessList.ok) return accessList

    const value: Redirect = { domain: domain.value, to: toRaw }
    if (o.enabled === false) value.enabled = false
    if (listen.value !== undefined && listen.value !== 80) value.listen = listen.value
    if (scheme !== 'auto') value.scheme = scheme as RedirectScheme
    if (codeInt.value !== undefined && codeInt.value !== 301) value.code = codeInt.value as RedirectCode
    if (o.preserve_path === false) value.preserve_path = false
    Object.assign(value, toggles.value)
    if (accessList.value) value.access_list = accessList.value
    return { ok: true, value }
}

/**
 * Validate + normalize a dead (parked) host (the `POST /api/routing/dead-hosts`
 * body): the 404|410|444|503 code enum plus the full WebOptions subset —
 * `force_ssl` IS allowed here, unlike on a redirect. Defaults are dropped
 * (code 404) so the rendered YAML stays minimal.
 */
export function parseDeadHost(input: unknown): Check<DeadHost> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'dead host must be an object')

    const domain = checkRoutingDomain(o.domain, 'dead host')
    if (!domain.ok) return domain

    if (o.enabled !== undefined && o.enabled !== null && typeof o.enabled !== 'boolean') {
        return reject('bad_enabled', 'enabled must be a boolean')
    }

    const listen = optInt(o.listen)
    if (!listen.ok || (listen.value !== undefined && (listen.value < 1 || listen.value > 65535))) {
        return reject('bad_listen', 'listen must be a port in 1..65535')
    }

    const codeInt = optInt(o.code)
    if (!codeInt.ok || (codeInt.value !== undefined && !DEAD_HOST_CODES.has(codeInt.value))) {
        return reject('bad_code', 'code must be 404, 410, 444 or 503')
    }

    const toggles = parseWebToggles(o, true)
    if (!toggles.ok) return toggles
    const accessList = checkAccessListRef(o.access_list)
    if (!accessList.ok) return accessList

    const value: DeadHost = { domain: domain.value }
    if (o.enabled === false) value.enabled = false
    if (listen.value !== undefined && listen.value !== 80) value.listen = listen.value
    if (codeInt.value !== undefined && codeInt.value !== 404) value.code = codeInt.value as DeadHostCode
    Object.assign(value, toggles.value)
    if (accessList.value) value.access_list = accessList.value
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
        '# generated by Quaykeeper; managed automatically, do not edit by hand.',
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
        '# generated by Quaykeeper; managed automatically, do not edit by hand.',
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
    hstsLines(p.hsts, lines)
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
    if (p.access_list) lines.push(`    access_list: ${scalar(p.access_list)}`)
    if (p.locations && p.locations.length) {
        lines.push('    locations:')
        for (const l of p.locations) {
            lines.push(`      - path: ${scalar(l.path)}`)
            if (l.upstream) lines.push(`        upstream: ${scalar(l.upstream)}`)
            if (l.pass) lines.push(`        pass: ${scalar(l.pass)}`)
            if (l.websocket) lines.push('        websocket: true')
            if (l.advanced) {
                lines.push('        advanced: |')
                for (const line of l.advanced.split('\n')) lines.push(line ? `          ${line}` : '')
            }
        }
    }
    return lines.join('\n') + '\n'
}

/**
 * Emit the `hsts:` line(s): the minimal bool write form, or the nested mapping when
 * custom options are set (the daemon's mapping form implies enabled).
 */
function hstsLines(h: boolean | HstsOptions | undefined, lines: string[]): void {
    if (!hstsEnabled(h)) return
    const opts: string[] = []
    if (typeof h === 'object' && h !== null) {
        if (h.max_age !== undefined && h.max_age > 0) opts.push(`      max_age: ${h.max_age}`)
        if (h.include_subdomains === false) opts.push('      include_subdomains: false')
        if (h.preload === true) opts.push('      preload: true')
    }
    if (opts.length === 0) {
        lines.push('    hsts: true')
        return
    }
    lines.push('    hsts:')
    lines.push(...opts)
}

/** Emit the shared web-toggle lines (deterministic order, matching the proxy emitter). */
function webToggleLines(w: WebToggles, lines: string[]): void {
    if (w.tls) lines.push(`    tls: ${scalar(w.tls)}`)
    if (w.force_ssl) lines.push('    force_ssl: true')
    if (w.http2) lines.push('    http2: true')
    hstsLines(w.hsts, lines)
    if (w.block_exploits) lines.push('    block_exploits: true')
    if (w.gzip) lines.push('    gzip: true')
    if (w.advanced) {
        lines.push('    advanced: |')
        for (const line of w.advanced.split('\n')) lines.push(line ? `      ${line}` : '')
    }
}

/** Render the `redirects: [ … ]` fragment for `POST /redirects` (exactly one redirect). */
export function renderRedirectFragment(r: Redirect): string {
    const lines: string[] = [
        '# generated by Quaykeeper; managed automatically, do not edit by hand.',
        'redirects:',
        `  - domain: ${scalar(r.domain)}`,
    ]
    if (r.enabled === false) lines.push('    enabled: false')
    if (r.listen) lines.push(`    listen: ${r.listen}`)
    lines.push(`    to: ${scalar(r.to)}`)
    if (r.scheme) lines.push(`    scheme: ${scalar(r.scheme)}`)
    if (r.code) lines.push(`    code: ${r.code}`)
    if (r.preserve_path === false) lines.push('    preserve_path: false')
    webToggleLines(r, lines)
    if (r.access_list) lines.push(`    access_list: ${scalar(r.access_list)}`)
    return lines.join('\n') + '\n'
}

/** Render the `dead_hosts: [ … ]` fragment for `POST /dead-hosts` (exactly one dead host). */
export function renderDeadHostFragment(d: DeadHost): string {
    const lines: string[] = [
        '# generated by Quaykeeper; managed automatically, do not edit by hand.',
        'dead_hosts:',
        `  - domain: ${scalar(d.domain)}`,
    ]
    if (d.enabled === false) lines.push('    enabled: false')
    if (d.listen) lines.push(`    listen: ${d.listen}`)
    if (d.code) lines.push(`    code: ${d.code}`)
    webToggleLines(d, lines)
    if (d.access_list) lines.push(`    access_list: ${scalar(d.access_list)}`)
    return lines.join('\n') + '\n'
}
