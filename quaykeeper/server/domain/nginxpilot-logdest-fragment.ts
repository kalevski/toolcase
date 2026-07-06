// Pure domain layer for nginxpilot log-shipping destinations (log_ides.md §2 / §4)
// — the control-plane counterpart to `domain/streams.ts`. No `server-only`, no I/O:
// the types import from client components AND the validation/rendering is
// unit-testable in isolation (golden-file tests live next to this file).
//
// Field names are snake_case to match nginxpilot's admin JSON/YAML 1:1 (a
// `GET /log-destinations` body deserializes straight into `LogDestination`;
// `renderLogDestFragment` emits the exact YAML the `POST /log-destinations`
// endpoint parses). nginxpilot re-validates every fragment against its running
// config (`internal/config/validate_logs.go`) and is the final authority; this
// front-runs it with the same rules so the UI gets fast, precise errors that
// match what the daemon would say (§4.1's "mirrored validation" promise).
//
// SECRETS BY REFERENCE ONLY: auth carries `*_env` / `*_file` reference NAMES,
// never secret bytes — the same parse-time rule as git tokens. A destination
// object never holds a password/token, so it is safe to serialize into a DTO.

import type { Check } from './routing'

// ── types (mirror nginxpilot/internal/config LogDestination YAML) ───────────────

/** Push/sink kind. `loki`/`http` push over the network; `file`/`stdout` are local. */
export type LogDestType = 'loki' | 'http' | 'file' | 'stdout'

/** Push-auth method. `none` (default) sends no Authorization header. */
export type LogAuthMethod = 'none' | 'basic' | 'bearer'

/**
 * A destination's credential block — reference names only. `basic` needs a
 * username + exactly one of `password_env`/`password_file`; `bearer` needs
 * exactly one of `token_env`/`token_file`. Inline secrets are a validation error.
 */
export interface LogAuth {
    method?: LogAuthMethod
    username?: string
    password_env?: string
    password_file?: string
    token_env?: string
    token_file?: string
}

/**
 * One log-shipping destination. Mirrors nginxpilot's config struct field-for-field
 * so a `GET /log-destinations` entry round-trips and a rendered fragment parses.
 */
export interface LogDestination {
    /** Identity + fragment-filename component — `[a-z0-9-]+` (guards the on-disk path). */
    name: string
    type: LogDestType
    /** Toggle shipping without deleting (omit = enabled). */
    enabled?: boolean

    // loki | http
    /** Push endpoint. `https://` required unless `allow_insecure`. */
    url?: string
    /** Loki `X-Scope-OrgID` tenant (loki only). */
    tenant?: string
    allow_insecure?: boolean
    /** Trust a private CA bundle for the push TLS connection (daemon-local path). */
    ca_file?: string
    insecure_skip_verify?: boolean
    auth?: LogAuth
    /** Loki label config (loki only): static `job`, dynamic `host`/`status_code`, extra statics. */
    labels?: Record<string, string>

    /** Field → matcher list; AND across fields, OR within a list. Omit = everything. */
    filter?: Record<string, string[]>
    /**
     * "{field} literal {field}" templates that turn an instance's plain-text log
     * lines into structured entries at the client (log_ides.md §5.2). INSTANCE
     * scope only — nginxpilot has no template step (its access logs are already
     * JSON), so this is never rendered into a daemon fragment.
     */
    parse?: string[]
    /** Keep roughly this fraction (0,1] of matched entries. */
    sample?: number

    // shipping tunables (omit = daemon default)
    batch_size?: number
    /** Go duration string ("2s"). */
    flush_interval?: string
    max_retries?: number
    buffer_size?: number

    // file
    /** Absolute NDJSON path (file only). */
    path?: string
    /** Human byte size ("64MiB") (file only). */
    max_size?: string
    max_files?: number
}

// ── validation (the write gate; mirrors internal/config/validate_logs.go) ───────

const LOGDEST_NAME = /^[a-z0-9-]+$/
const TYPES: ReadonlySet<string> = new Set(['loki', 'http', 'file', 'stdout'])
const AUTH_METHODS: ReadonlySet<string> = new Set(['none', 'basic', 'bearer'])
const LOKI_LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const HOST_LABEL_SOURCES: ReadonlySet<string> = new Set(['$resource', '$host', '$server_name'])
const STATUS_LABEL_SOURCES: ReadonlySet<string> = new Set(['$status', '$status_class'])
/** The access-log fields a filter may key on — mirrors logship.FieldsAccess. */
const FILTER_FIELDS: ReadonlySet<string> = new Set([
    'host',
    'resource',
    'path',
    'user_agent',
    'status',
    'method',
    'scheme',
    'resource_type',
])
/** Extra static Loki labels per destination (G16). */
const MAX_EXTRA_LABELS = 5

const reject = <T>(reason: string, message: string): Check<T> => ({ ok: false, reason, message })

function asObject(input: unknown): Record<string, unknown> | null {
    return input && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : null
}

/** A finite, non-negative integer (batch_size / max_retries / …). */
function optInt(value: unknown): { ok: true; value?: number } | { ok: false } {
    if (value === undefined || value === null || value === '') return { ok: true }
    const n = typeof value === 'string' ? Number(value) : value
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return { ok: false }
    return { ok: true, value: n }
}

function optStr(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

/** Validate the auth block, mirroring validateLogAuth. */
function parseLogAuth(input: unknown): Check<LogAuth | undefined> {
    if (input === undefined || input === null) return { ok: true, value: undefined }
    const o = asObject(input)
    if (!o) return reject('bad_auth', 'auth must be an object')

    // Inline secrets are never allowed — refs only.
    if (optStr(o.password) || optStr(o.token)) {
        return reject('inline_secret', 'inline secrets are not allowed: use auth.*_env or auth.*_file')
    }

    const methodRaw = o.method === undefined || o.method === null || o.method === '' ? 'none' : o.method
    if (typeof methodRaw !== 'string' || !AUTH_METHODS.has(methodRaw)) {
        return reject('bad_auth_method', 'auth.method must be none, basic or bearer')
    }
    const method = methodRaw as LogAuthMethod

    const username = optStr(o.username)
    const passwordEnv = optStr(o.password_env)
    const passwordFile = optStr(o.password_file)
    const tokenEnv = optStr(o.token_env)
    const tokenFile = optStr(o.token_file)

    if (method === 'none') {
        if (username || passwordEnv || passwordFile || tokenEnv || tokenFile) {
            return reject('auth_none', 'auth fields set but auth.method is none')
        }
        return { ok: true, value: undefined }
    }
    if (method === 'basic') {
        if (!username) return reject('username_required', 'auth.username is required for basic auth')
        if (!!passwordEnv === !!passwordFile) {
            return reject('one_password_ref', 'basic auth needs exactly one of auth.password_env / auth.password_file')
        }
        if (tokenEnv || tokenFile) return reject('bad_token_ref', 'token refs only apply to auth.method: bearer')
        const value: LogAuth = { method, username }
        if (passwordEnv) value.password_env = passwordEnv
        if (passwordFile) value.password_file = passwordFile
        return { ok: true, value }
    }
    // bearer
    if (username) return reject('bad_username', 'auth.username only applies to auth.method: basic')
    if (!!tokenEnv === !!tokenFile) {
        return reject('one_token_ref', 'bearer auth needs exactly one of auth.token_env / auth.token_file')
    }
    if (passwordEnv || passwordFile) return reject('bad_password_ref', 'password refs only apply to auth.method: basic')
    const value: LogAuth = { method }
    if (tokenEnv) value.token_env = tokenEnv
    if (tokenFile) value.token_file = tokenFile
    return { ok: true, value }
}

/** Validate the Loki label contract (§3.2, G15/G16), mirroring validateLogLabels. */
function parseLabels(input: unknown): Check<Record<string, string> | undefined> {
    if (input === undefined || input === null) return { ok: true, value: undefined }
    const o = asObject(input)
    if (!o) return reject('bad_labels', 'labels must be an object')

    const out: Record<string, string> = {}
    let extras = 0
    for (const [k, raw] of Object.entries(o)) {
        const v = typeof raw === 'string' ? raw : String(raw ?? '')
        if (!v) return reject('empty_label', `labels.${k}: value must not be empty`)
        if (k === 'job') {
            if (v.startsWith('$')) return reject('bad_job', 'labels.job must be a static string')
        } else if (k === 'host') {
            if (!HOST_LABEL_SOURCES.has(v)) {
                return reject('bad_host_label', `labels.host ${JSON.stringify(v)}: must be $resource, $host or $server_name`)
            }
        } else if (k === 'status_code') {
            if (!STATUS_LABEL_SOURCES.has(v)) {
                return reject('bad_status_label', `labels.status_code ${JSON.stringify(v)}: must be $status or $status_class`)
            }
        } else {
            if (!LOKI_LABEL_NAME.test(k)) {
                return reject('bad_label_name', `labels.${k}: label names must match [a-zA-Z_][a-zA-Z0-9_]*`)
            }
            if (k.startsWith('__')) return reject('reserved_label', `labels.${k}: the __ prefix is reserved by Loki`)
            if (v.startsWith('$')) {
                return reject('dynamic_extra', `labels.${k}: only host and status_code may be dynamic; extra labels must be static`)
            }
            extras++
        }
        out[k] = v
    }
    if (extras > MAX_EXTRA_LABELS) {
        return reject('too_many_labels', `labels: at most ${MAX_EXTRA_LABELS} extra static labels (got ${extras})`)
    }
    return { ok: true, value: Object.keys(out).length ? out : undefined }
}

const TEMPLATE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Validate one parse template, mirroring the client's CompileTemplate rules so the
 * form rejects exactly what the client couldn't compile: at least one `{field}`,
 * balanced braces, valid field names, and no two adjacent `{fields}` (they can't be
 * split without a literal separator).
 */
function validateTemplate(tmpl: string): string | null {
    if (!tmpl.trim()) return 'template must not be empty'
    let fields = 0
    let lastWasToken = false
    for (let i = 0; i < tmpl.length; ) {
        if (tmpl[i] === '{') {
            const end = tmpl.indexOf('}', i)
            if (end < 0) return `unclosed '{' in ${JSON.stringify(tmpl)}`
            const name = tmpl.slice(i + 1, end)
            if (!TEMPLATE_FIELD.test(name)) return `bad field name ${JSON.stringify(name)} (must match [A-Za-z_][A-Za-z0-9_]*)`
            if (lastWasToken) return 'two adjacent {fields} need a literal separator between them'
            fields++
            lastWasToken = true
            i = end + 1
        } else {
            if (tmpl[i] === '}') return `unexpected '}' in ${JSON.stringify(tmpl)}`
            lastWasToken = false
            i++
        }
    }
    if (fields === 0) return `template ${JSON.stringify(tmpl)} has no {fields}`
    return null
}

/** Validate the parse-template list (instance scope only — enforced by the service). */
function parseTemplates(input: unknown): Check<string[] | undefined> {
    if (input === undefined || input === null) return { ok: true, value: undefined }
    if (!Array.isArray(input)) return reject('bad_parse', 'parse must be an array of template strings')
    const out: string[] = []
    for (const raw of input) {
        if (typeof raw !== 'string') return reject('bad_parse', 'each parse template must be a string')
        const t = raw.trim()
        if (!t) continue
        const err = validateTemplate(t)
        if (err) return reject('bad_parse_template', `parse template: ${err}`)
        out.push(t)
    }
    return { ok: true, value: out.length ? out : undefined }
}

/** Validate the filter map (shape only — nginxpilot's engine is the grammar authority). */
function parseFilter(input: unknown): Check<Record<string, string[]> | undefined> {
    if (input === undefined || input === null) return { ok: true, value: undefined }
    const o = asObject(input)
    if (!o) return reject('bad_filter', 'filter must be an object')

    const out: Record<string, string[]> = {}
    for (const [field, raw] of Object.entries(o)) {
        if (!FILTER_FIELDS.has(field)) {
            return reject('bad_filter_field', `filter field ${JSON.stringify(field)} is not filterable (known: ${[...FILTER_FIELDS].sort().join(', ')})`)
        }
        if (!Array.isArray(raw) || raw.length === 0) {
            return reject('empty_matchers', `filter field ${JSON.stringify(field)}: matcher list must be a non-empty array (omit the field to match everything)`)
        }
        const list: string[] = []
        for (const m of raw) {
            const s = typeof m === 'string' ? m : String(m ?? '')
            if (!s) return reject('empty_matcher', `filter field ${JSON.stringify(field)}: empty matcher`)
            list.push(s)
        }
        out[field] = list
    }
    return { ok: true, value: Object.keys(out).length ? out : undefined }
}

/**
 * Validate + normalize a log destination (the write/test body). Mirrors
 * nginxpilot's `validateLogDestination`: type-specific field sanity, secrets by
 * reference only, the Loki label contract, and filter shape. Empty optionals are
 * dropped so the rendered YAML — and the stored row — stay minimal.
 */
export function parseLogDestination(input: unknown): Check<LogDestination> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'log destination must be an object')

    const name = optStr(o.name)
    if (!name) return reject('name_required', 'log destination name is required')
    if (!LOGDEST_NAME.test(name)) return reject('bad_name', 'name must match [a-z0-9-]+ (it becomes the fragment filename)')

    const type = optStr(o.type)
    if (!type) return reject('type_required', 'type is required (loki | http | file | stdout)')
    if (!TYPES.has(type)) return reject('bad_type', 'type must be loki | http | file | stdout')

    const value: LogDestination = { name, type: type as LogDestType }
    if (o.enabled === false) value.enabled = false
    else if (o.enabled === true) value.enabled = true

    const isPush = type === 'loki' || type === 'http'

    if (isPush) {
        const url = optStr(o.url)
        if (!url) return reject('url_required', `url is required for type: ${type}`)
        let parsed: URL
        try {
            parsed = new URL(url)
        } catch {
            return reject('bad_url', `url ${JSON.stringify(url)} is not a valid URL`)
        }
        const allowInsecure = o.allow_insecure === true
        if (parsed.protocol === 'http:') {
            if (!allowInsecure) return reject('insecure_url', 'http:// URLs require allow_insecure: true (https:// is the default)')
        } else if (parsed.protocol !== 'https:') {
            return reject('bad_scheme', `url ${JSON.stringify(url)}: must be https:// (or http:// with allow_insecure: true)`)
        }
        value.url = url
        if (allowInsecure) value.allow_insecure = true
        const caFile = optStr(o.ca_file)
        if (caFile) value.ca_file = caFile
        if (o.insecure_skip_verify === true) {
            if (!allowInsecure) return reject('skip_verify', 'insecure_skip_verify requires allow_insecure: true')
            value.insecure_skip_verify = true
        }

        const auth = parseLogAuth(o.auth)
        if (!auth.ok) return auth
        if (auth.value) value.auth = auth.value

        if (type === 'http') {
            if (optStr(o.tenant)) return reject('http_tenant', 'tenant only applies to type: loki')
            if (asObject(o.labels)) return reject('http_labels', 'labels only apply to type: loki (an http collector receives the full JSON lines)')
        } else {
            const tenant = optStr(o.tenant)
            if (tenant) value.tenant = tenant
            const labels = parseLabels(o.labels)
            if (!labels.ok) return labels
            if (labels.value) value.labels = labels.value
        }
        if (optStr(o.path) || o.max_size !== undefined || o.max_files !== undefined) {
            return reject('push_file_fields', 'path / max_size / max_files only apply to type: file')
        }
    } else {
        // file | stdout — reject push-only fields.
        if (optStr(o.url) || optStr(o.tenant) || optStr(o.ca_file) || o.insecure_skip_verify === true || o.allow_insecure === true) {
            return reject('local_push_fields', 'url / tenant / ca_file / tls options only apply to type: loki | http')
        }
        if (asObject(o.auth) && optStr((asObject(o.auth) as Record<string, unknown>).method) && optStr((asObject(o.auth) as Record<string, unknown>).method) !== 'none') {
            return reject('local_auth', 'auth only applies to type: loki | http')
        }
        if (asObject(o.labels)) return reject('local_labels', 'labels only apply to type: loki')

        if (type === 'file') {
            const path = optStr(o.path)
            if (!path) return reject('path_required', 'path is required for type: file')
            if (!path.startsWith('/')) return reject('rel_path', `path ${JSON.stringify(path)} must be absolute`)
            value.path = path
            const maxSize = optStr(o.max_size)
            if (maxSize) value.max_size = maxSize
            const maxFiles = optInt(o.max_files)
            if (!maxFiles.ok) return reject('bad_max_files', 'max_files must be a non-negative integer')
            if (maxFiles.value !== undefined) value.max_files = maxFiles.value
        } else if (optStr(o.path) || o.max_size !== undefined || o.max_files !== undefined) {
            return reject('stdout_file_fields', 'path / max_size / max_files only apply to type: file')
        }
    }

    const filter = parseFilter(o.filter)
    if (!filter.ok) return filter
    if (filter.value) value.filter = filter.value

    const parse = parseTemplates(o.parse)
    if (!parse.ok) return parse
    if (parse.value) value.parse = parse.value

    if (o.sample !== undefined && o.sample !== null && o.sample !== '') {
        const s = typeof o.sample === 'string' ? Number(o.sample) : o.sample
        if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0 || s > 1) {
            return reject('bad_sample', 'sample must be a number in (0, 1]')
        }
        value.sample = s
    }

    const batchSize = optInt(o.batch_size)
    if (!batchSize.ok) return reject('bad_batch_size', 'batch_size must be a non-negative integer')
    if (batchSize.value !== undefined) value.batch_size = batchSize.value
    const maxRetries = optInt(o.max_retries)
    if (!maxRetries.ok) return reject('bad_max_retries', 'max_retries must be a non-negative integer')
    if (maxRetries.value !== undefined) value.max_retries = maxRetries.value
    const bufferSize = optInt(o.buffer_size)
    if (!bufferSize.ok) return reject('bad_buffer_size', 'buffer_size must be a non-negative integer')
    if (bufferSize.value !== undefined) value.buffer_size = bufferSize.value
    const flushInterval = optStr(o.flush_interval)
    if (flushInterval) value.flush_interval = flushInterval

    return { ok: true, value }
}

// ── YAML rendering (the POST body; mirrors domain/streams.ts) ───────────────────

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

/**
 * Render the `log_destinations: [ … ]` fragment for `POST /log-destinations`
 * (exactly one destination). Secret material is NEVER emitted — only the
 * `*_env` / `*_file` reference names. Key order is deterministic for golden tests.
 */
export function renderLogDestFragment(d: LogDestination): string {
    const lines: string[] = [
        '# generated by Quaykeeper; managed automatically, do not edit by hand.',
        'log_destinations:',
        `  - name: ${scalar(d.name)}`,
        `    type: ${scalar(d.type)}`,
    ]
    if (d.enabled === false) lines.push('    enabled: false')

    if (d.url) lines.push(`    url: ${scalar(d.url)}`)
    if (d.tenant) lines.push(`    tenant: ${scalar(d.tenant)}`)
    if (d.allow_insecure) lines.push('    allow_insecure: true')
    if (d.ca_file) lines.push(`    ca_file: ${scalar(d.ca_file)}`)
    if (d.insecure_skip_verify) lines.push('    insecure_skip_verify: true')

    if (d.auth && d.auth.method && d.auth.method !== 'none') {
        lines.push('    auth:')
        lines.push(`      method: ${scalar(d.auth.method)}`)
        if (d.auth.username) lines.push(`      username: ${scalar(d.auth.username)}`)
        if (d.auth.password_env) lines.push(`      password_env: ${scalar(d.auth.password_env)}`)
        if (d.auth.password_file) lines.push(`      password_file: ${scalar(d.auth.password_file)}`)
        if (d.auth.token_env) lines.push(`      token_env: ${scalar(d.auth.token_env)}`)
        if (d.auth.token_file) lines.push(`      token_file: ${scalar(d.auth.token_file)}`)
    }

    if (d.labels && Object.keys(d.labels).length) {
        lines.push('    labels:')
        for (const k of Object.keys(d.labels).sort()) {
            lines.push(`      ${scalar(k)}: ${scalar(d.labels[k])}`)
        }
    }

    if (d.filter && Object.keys(d.filter).length) {
        lines.push('    filter:')
        for (const field of Object.keys(d.filter).sort()) {
            lines.push(`      ${scalar(field)}:`)
            for (const m of d.filter[field]) lines.push(`        - ${scalar(m)}`)
        }
    }

    if (d.sample !== undefined) lines.push(`    sample: ${d.sample}`)
    if (d.batch_size !== undefined) lines.push(`    batch_size: ${d.batch_size}`)
    if (d.flush_interval) lines.push(`    flush_interval: ${scalar(d.flush_interval)}`)
    if (d.max_retries !== undefined) lines.push(`    max_retries: ${d.max_retries}`)
    if (d.buffer_size !== undefined) lines.push(`    buffer_size: ${d.buffer_size}`)

    if (d.path) lines.push(`    path: ${scalar(d.path)}`)
    if (d.max_size) lines.push(`    max_size: ${scalar(d.max_size)}`)
    if (d.max_files !== undefined) lines.push(`    max_files: ${d.max_files}`)

    return lines.join('\n') + '\n'
}

/** Deterministic fragment filename for a destination — `logdest-<name>.yml`. */
export function logDestFragmentFilename(name: string): string {
    if (!LOGDEST_NAME.test(name)) {
        throw new Error(`[quaykeeper] unsafe log destination name ${JSON.stringify(name)}: expected ${LOGDEST_NAME}`)
    }
    return `logdest-${name}.yml`
}

/**
 * The LogQL stream selector a Loki destination's labels resolve to — powers the
 * UI preview pane and the Grafana deep-link (§4.2). Dynamic sources render as
 * their resolved label name with a `=~".+"` "any value" matcher (the concrete
 * value is per-request); static labels render exact.
 */
export function logqlSelector(d: LogDestination): string {
    const parts: string[] = [`job="${d.labels?.job ?? 'nginx'}"`]
    if (d.labels) {
        for (const k of Object.keys(d.labels).sort()) {
            if (k === 'job') continue
            const v = d.labels[k]
            if (v.startsWith('$')) parts.push(`${k}=~".+"`)
            else parts.push(`${k}="${v}"`)
        }
    }
    return `{${parts.join(', ')}}`
}
