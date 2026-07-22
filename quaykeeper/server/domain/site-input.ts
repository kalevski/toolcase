// Pure create/update input validation for a site's deploy *source* (§9, §16) — no
// `server-only`, no I/O. The hostname half of a site's input is validated by
// `domain/hostname.ts` (§729); this covers the GitHub coordinates and the build
// subdir, which flow into the git URL and the nginxpilot fragment. Keeping it pure
// (mirrors `domain/hostname.ts`) lets the shape rules be unit-tested directly, and
// keeps `services/sites.ts` to repository + orchestration wiring.
//
// Values are quoted defensively when rendered into YAML (`domain/nginxpilot-fragment.ts`),
// but rejecting malformed input here is the first gate — a site never reaches a
// fragment, a git URL, or the DB with a garbage repo/branch/subdir (§16).
//
// See notes/static-hosting-app-design.md §9, §16.

import type { SiteAuthMethod, SiteRouting, SiteSource, SiteSourceType, SiteTls } from './types'

// ── shapes ─────────────────────────────────────────────────────────────────────

/**
 * Why a source field was rejected (machine-readable; the service maps it to 400).
 * `range` = a number outside its allowed bounds; `count` = a list with too many
 * entries; `type` = the JSON value wasn't the expected kind (e.g. `exclude` not an array).
 */
export type SourceRejection =
    | 'empty'
    | 'too_long'
    | 'charset'
    | 'traversal'
    | 'enum'
    | 'range'
    | 'count'
    | 'type'

/** Result of a required-field check: the normalized value, or a typed rejection. */
export type FieldCheck =
    | { ok: true; value: string }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of the optional subdir check: a normalized value (or `undefined` when omitted). */
export type SubdirCheck =
    | { ok: true; value: string | undefined }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of the optional routing check: a normalized mode (`undefined` = static default). */
export type RoutingCheck =
    | { ok: true; value: SiteRouting | undefined }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of an optional string-list check (`exclude` / `require_file`). */
export type ListCheck =
    | { ok: true; value: string[] | undefined }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of an optional bounded-integer check (`keep_releases` / `interval`). */
export type NumberCheck =
    | { ok: true; value: number | undefined }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of the optional per-site TLS-mode check (`undefined` = the default, `auto`). */
export type TlsCheck =
    | { ok: true; value: SiteTls | undefined }
    | { ok: false; reason: SourceRejection; message: string }

// ── limits + charsets ───────────────────────────────────────────────────────────

/** GitHub login (user/org) max length. */
export const MAX_OWNER_LENGTH = 39
/** GitHub repository name max length. */
export const MAX_REPO_LENGTH = 100
/** Conservative cap for a git branch ref / build subdir. */
export const MAX_REF_LENGTH = 255

// A GitHub owner login: alphanumeric + single internal hyphens, no leading/trailing
// hyphen. (Orgs follow the same rule.)
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9]))*$/
// A GitHub repo name: letters, digits, dot, underscore, hyphen.
const REPO_PATTERN = /^[A-Za-z0-9._-]+$/
// A branch / subdir path: letters, digits, dot, underscore, hyphen, slash. The
// `..` / leading-slash / `//` checks below close traversal and absolute paths.
const PATH_PATTERN = /^[A-Za-z0-9._\/-]+$/

// ── repo coordinates ─────────────────────────────────────────────────────────────

/** Validate a GitHub owner login. Trimmed; case is preserved (GitHub paths are case-tolerant). */
export function checkRepoOwner(raw: string): FieldCheck {
    const value = raw.trim()
    if (value === '') return { ok: false, reason: 'empty', message: 'repository owner is required' }
    if (value.length > MAX_OWNER_LENGTH) {
        return { ok: false, reason: 'too_long', message: `repository owner must be at most ${MAX_OWNER_LENGTH} characters` }
    }
    if (!OWNER_PATTERN.test(value)) {
        return {
            ok: false,
            reason: 'charset',
            message: 'repository owner must be a valid GitHub login (letters, digits, single internal hyphens)',
        }
    }
    return { ok: true, value }
}

/** Validate a GitHub repository name. */
export function checkRepoName(raw: string): FieldCheck {
    const value = raw.trim()
    if (value === '') return { ok: false, reason: 'empty', message: 'repository name is required' }
    if (value.length > MAX_REPO_LENGTH) {
        return { ok: false, reason: 'too_long', message: `repository name must be at most ${MAX_REPO_LENGTH} characters` }
    }
    if (value === '.' || value === '..' || !REPO_PATTERN.test(value)) {
        return {
            ok: false,
            reason: 'charset',
            message: 'repository name must be letters, digits, dots, underscores, or hyphens',
        }
    }
    return { ok: true, value }
}

/** Validate a git branch ref. Conservative: rejects whitespace, `..`, and bad slashes. */
export function checkBranch(raw: string): FieldCheck {
    const value = raw.trim()
    if (value === '') return { ok: false, reason: 'empty', message: 'branch is required' }
    if (value.length > MAX_REF_LENGTH) {
        return { ok: false, reason: 'too_long', message: `branch must be at most ${MAX_REF_LENGTH} characters` }
    }
    if (value.includes('..')) {
        return { ok: false, reason: 'traversal', message: 'branch must not contain ".."' }
    }
    if (!PATH_PATTERN.test(value) || value.startsWith('/') || value.endsWith('/') || value.includes('//') || value.startsWith('-')) {
        return {
            ok: false,
            reason: 'charset',
            message: 'branch must be a valid git ref (letters, digits, dots, underscores, hyphens, slashes)',
        }
    }
    return { ok: true, value }
}

// ── static-serving settings (optional; mirror nginxpilot's per-site validation) ───

const ROUTING_MODES: SiteRouting[] = ['static', 'spa', 'clean-urls']

/**
 * Validate an optional routing mode. `undefined`/`null`/empty/`static` all normalize
 * to `undefined` (nginxpilot's default), so a default row stores NULL and the
 * fragment stays byte-for-byte unchanged for plain static sites.
 */
export function checkRouting(raw: string | null | undefined): RoutingCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '' || value === 'static') return { ok: true, value: undefined }
    if (!ROUTING_MODES.includes(value as SiteRouting)) {
        return { ok: false, reason: 'enum', message: 'routing must be "static", "spa", or "clean-urls"' }
    }
    return { ok: true, value: value as SiteRouting }
}

/**
 * Validate an optional custom 404 page path (e.g. `/404.html`). Must be an absolute,
 * clean site path — it is emitted verbatim into the fragment's `not_found` and from
 * there into an nginx `error_page` directive (§16). Empty/null normalize to "none".
 * The spa-conflict rule (no 404 page when every path serves index.html) is cross-field,
 * so it lives in the service, not here.
 */
export function checkNotFound(raw: string | null | undefined): SubdirCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (value.length > MAX_REF_LENGTH) {
        return { ok: false, reason: 'too_long', message: `404 page path must be at most ${MAX_REF_LENGTH} characters` }
    }
    if (!value.startsWith('/')) {
        return { ok: false, reason: 'traversal', message: '404 page must be an absolute site path like "/404.html"' }
    }
    if (value.includes('..')) {
        return { ok: false, reason: 'traversal', message: '404 page path must not contain ".."' }
    }
    if (!PATH_PATTERN.test(value.slice(1)) || value.includes('//')) {
        return {
            ok: false,
            reason: 'charset',
            message: '404 page must be a path of letters, digits, dots, underscores, hyphens, and slashes',
        }
    }
    return { ok: true, value }
}

// ── build subdir (optional) ──────────────────────────────────────────────────────

/**
 * Validate an optional build subdir (e.g. `dist/`, `build`). `undefined`/`null`/empty
 * all normalize to "no subdir". Rejects absolute paths and `..` traversal so the value
 * is a safe relative path before it reaches the fragment (§16).
 */
export function checkSubdir(raw: string | null | undefined): SubdirCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (value.length > MAX_REF_LENGTH) {
        return { ok: false, reason: 'too_long', message: `subdir must be at most ${MAX_REF_LENGTH} characters` }
    }
    if (value.startsWith('/')) {
        return { ok: false, reason: 'traversal', message: 'subdir must be a relative path (no leading "/")' }
    }
    if (value.includes('..')) {
        return { ok: false, reason: 'traversal', message: 'subdir must not contain ".."' }
    }
    if (!PATH_PATTERN.test(value) || value.includes('//')) {
        return {
            ok: false,
            reason: 'charset',
            message: 'subdir must be a relative path of letters, digits, dots, underscores, hyphens, and slashes',
        }
    }
    return { ok: true, value }
}

// ── source kind, URL, and auth (git hosts beyond GitHub; http-zip archives) ──────

/** Max length of a source / checksum URL. */
export const MAX_URL_LENGTH = 2048

// A URL we're willing to hand to the daemon: printable ASCII, no whitespace, no quotes,
// no backslashes. Scheme and host shape are checked separately; this is the character
// gate that keeps a URL from carrying anything a shell or YAML layer could reinterpret.
const URL_SAFE = /^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/

/** An `scp`-style git remote (`git@host:owner/repo.git`) — the form deploy keys use. */
const SCP_GIT_URL = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9._~/-]+$/

/** Result of the source-type check (`undefined` = `git`, the default). */
export type SourceTypeCheck =
    | { ok: true; value: SiteSourceType | undefined }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of the auth-method check (`undefined` = let the service pick the default). */
export type AuthMethodCheck =
    | { ok: true; value: SiteAuthMethod | undefined }
    | { ok: false; reason: SourceRejection; message: string }

/** Validate an optional source type. Empty/`git` normalize to `undefined` (the default). */
export function checkSourceType(raw: string | null | undefined): SourceTypeCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '' || value === 'git') return { ok: true, value: undefined }
    if (value !== 'http-zip') {
        return { ok: false, reason: 'enum', message: 'the source type must be "git" or "http-zip"' }
    }
    return { ok: true, value }
}

const AUTH_METHODS: SiteAuthMethod[] = [
    'none',
    'ssh-key',
    'https-token',
    'github-token',
    'bearer',
    'basic',
    'header',
]

/** Validate an optional auth method. Empty normalizes to `undefined` (service default). */
export function checkAuthMethod(raw: string | null | undefined): AuthMethodCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (!AUTH_METHODS.includes(value as SiteAuthMethod)) {
        return { ok: false, reason: 'enum', message: `the auth method must be one of: ${AUTH_METHODS.join(', ')}` }
    }
    return { ok: true, value: value as SiteAuthMethod }
}

/**
 * Best-effort owner/name labels for a source that isn't a GitHub repo, so the dashboard
 * and audit log still have something meaningful to show for a GitLab clone or a CI
 * archive. Purely cosmetic — the actual fetch always uses `sourceUrl` — so this falls
 * back to the host rather than failing on an unusual URL shape.
 */
export function describeSourceUrl(url: string): { owner: string; name: string } {
    const sanitize = (raw: string, fallback: string): string => {
        const cleaned = raw.replace(/\.(git|zip|tar|tgz|gz)$/i, '').replace(/[^A-Za-z0-9._-]/g, '-')
        const trimmed = cleaned.replace(/^[-.]+|[-.]+$/g, '').slice(0, MAX_REPO_LENGTH)
        return trimmed === '' ? fallback : trimmed
    }
    // `git@host:owner/repo.git` isn't a parseable URL, so normalize it to one first.
    const normalized = SCP_GIT_URL.test(url) ? `ssh://${url.replace(':', '/')}` : url
    let host = 'source'
    let segments: string[]
    try {
        const parsed = new URL(normalized)
        host = parsed.hostname || host
        segments = parsed.pathname.split('/').filter((s) => s !== '')
    } catch {
        segments = normalized.split('/').filter((s) => s !== '')
    }
    const name = sanitize(segments[segments.length - 1] ?? host, 'site')
    const owner = sanitize(segments.length >= 2 ? segments[segments.length - 2] : host, 'source')
    return { owner, name }
}

/** Whether a git URL speaks SSH (`git@…` or `ssh://…`) rather than HTTPS. */
export function isSshGitUrl(url: string): boolean {
    return url.startsWith('git@') || url.startsWith('ssh://')
}

/**
 * Validate a source URL for a given source type, mirroring nginxpilot's own rules:
 *
 *   • git      — `https://`, `ssh://`, or `git@host:path`. Plain `http://` is refused
 *                outright; a clone is a supply-chain input and there is no reason to
 *                fetch one unauthenticated over cleartext.
 *   • http-zip — `https://`, or `http://` only when the caller has explicitly accepted
 *                the risk via `allowInsecure`.
 */
export function checkSourceUrl(
    raw: string | null | undefined,
    type: 'git' | 'http-zip',
    allowInsecure = false,
): SubdirCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (value.length > MAX_URL_LENGTH) {
        return { ok: false, reason: 'too_long', message: `the source URL must be at most ${MAX_URL_LENGTH} characters` }
    }
    if (!URL_SAFE.test(value)) {
        return { ok: false, reason: 'charset', message: 'the source URL contains characters that are not allowed' }
    }
    if (type === 'git') {
        const ok = value.startsWith('https://') || value.startsWith('ssh://') || SCP_GIT_URL.test(value)
        if (!ok) {
            return {
                ok: false,
                reason: 'charset',
                message: 'a git URL must be https://…, ssh://…, or git@host:owner/repo.git',
            }
        }
        return { ok: true, value }
    }
    if (value.startsWith('https://')) return { ok: true, value }
    if (value.startsWith('http://')) {
        if (allowInsecure) return { ok: true, value }
        return {
            ok: false,
            reason: 'charset',
            message: 'an http:// archive URL needs "allow insecure" turned on — prefer https://',
        }
    }
    return { ok: false, reason: 'charset', message: 'an archive URL must be https:// (or http:// with "allow insecure")' }
}

/** Validate the optional `http-zip` checksum URL. Same scheme rules as the archive itself. */
export function checkChecksumUrl(raw: string | null | undefined, allowInsecure = false): SubdirCheck {
    const c = checkSourceUrl(raw, 'http-zip', allowInsecure)
    if (!c.ok) {
        return { ...c, message: c.message.replace('archive URL', 'checksum URL').replace('source URL', 'checksum URL') }
    }
    return c
}

/** Validate the optional `http-zip` `strip_components` depth. */
export function checkStripComponents(raw: unknown): NumberCheck {
    if (raw === undefined || raw === null) return { ok: true, value: undefined }
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
        return { ok: false, reason: 'type', message: 'stripComponents must be a whole number' }
    }
    if (raw < 0 || raw > 16) {
        return { ok: false, reason: 'range', message: 'stripComponents must be between 0 and 16' }
    }
    return { ok: true, value: raw }
}

/** Validate an optional auth username (`https-token` / `basic`). Not a secret. */
export function checkAuthUsername(raw: string | null | undefined): SubdirCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (value.length > MAX_OWNER_LENGTH * 2) {
        return { ok: false, reason: 'too_long', message: 'the username is too long' }
    }
    if (!/^[A-Za-z0-9._@+-]+$/.test(value)) {
        return { ok: false, reason: 'charset', message: 'the username contains characters that are not allowed' }
    }
    return { ok: true, value }
}

/** Validate an optional HTTP header name (`header` auth) against the RFC 7230 token charset. */
export function checkAuthHeaderName(raw: string | null | undefined): SubdirCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (value.length > 64) {
        return { ok: false, reason: 'too_long', message: 'the header name is too long' }
    }
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(value)) {
        return { ok: false, reason: 'charset', message: 'a header name may only contain HTTP token characters' }
    }
    return { ok: true, value }
}

/** Result of the cross-field source check: a normalized, internally consistent spec. */
export type SourceSpecCheck =
    | { ok: true; value: SiteSource }
    | { ok: false; reason: SourceRejection; message: string }

/**
 * Validate a whole source spec's *internal consistency* — the cross-field rules
 * nginxpilot itself enforces, applied here so an impossible combination is a 400 on the
 * request rather than a 502 bouncing off the daemon's `POST /sites`:
 *
 *   • git needs a branch and rejects the archive-only fields; http-zip needs an explicit
 *     URL and rejects `subdir` (it has `strip_components` instead).
 *   • an SSH git URL requires `ssh-key`, and `ssh-key` requires an SSH URL;
 *     `https-token`/`github-token` require an HTTPS URL.
 *   • `https-token` and `basic` require a username; `github-token` forbids one (the
 *     token alone authenticates); `header` requires a header name.
 *   • the archive auth methods are for archives only, and vice versa.
 *
 * Individual field shapes are the `check*` functions above — this only sees already
 * normalized values.
 */
export function checkSourceSpec(spec: SiteSource): SourceSpecCheck {
    const type = spec.sourceType ?? 'git'
    const method = spec.authMethod ?? 'none'
    const reject = (message: string, reason: SourceRejection = 'enum'): SourceSpecCheck => ({
        ok: false,
        reason,
        message,
    })

    if (type === 'git') {
        if (!spec.branch || spec.branch.trim() === '') return reject('a git source needs a branch', 'empty')
        if (spec.checksumUrl || spec.stripComponents !== undefined || spec.allowInsecure) {
            return reject('checksum URL, strip components, and "allow insecure" only apply to archive sources')
        }
        // No explicit URL means the GitHub repo coordinates supply it, which is always https.
        const ssh = spec.sourceUrl ? isSshGitUrl(spec.sourceUrl) : false
        if (ssh && method !== 'ssh-key') {
            return reject('an ssh git URL needs the "deploy key" auth method')
        }
        if (method === 'ssh-key' && !ssh) {
            return reject('the "deploy key" auth method needs an ssh URL (git@host:owner/repo.git or ssh://…)')
        }
        if ((method === 'https-token' || method === 'github-token') && ssh) {
            return reject('token auth needs an https git URL')
        }
        if (method === 'bearer' || method === 'basic' || method === 'header') {
            return reject('that auth method is for archive sources; a git source uses a deploy key or a token')
        }
        if (method === 'https-token' && !spec.authUsername) {
            return reject('token auth for this host needs a username', 'empty')
        }
        if (method === 'github-token' && spec.authUsername) {
            return reject('a GitHub token authenticates on its own — leave the username blank')
        }
    } else {
        if (!spec.sourceUrl) return reject('an archive source needs a URL', 'empty')
        if (spec.subdir) {
            return reject('an archive source uses "strip components" rather than a build subdirectory')
        }
        if (method === 'ssh-key' || method === 'https-token' || method === 'github-token') {
            return reject('that auth method is for git sources; an archive uses a bearer token, basic auth, or a header')
        }
        if (method === 'basic' && !spec.authUsername) {
            return reject('basic auth needs a username', 'empty')
        }
        if (method === 'header' && !spec.authHeaderName) {
            return reject('header auth needs a header name', 'empty')
        }
    }

    if (method !== 'header' && spec.authHeaderName) {
        return reject('a header name only applies to header auth')
    }
    if (method === 'none' && spec.authUsername) {
        return reject('a username only applies when the source needs authentication')
    }
    return { ok: true, value: spec }
}

// ── source-tree controls (exclude / require_file / keep_releases / interval) ─────

/** Max entries in a per-site `exclude` list — a deny-list, not a build manifest. */
export const MAX_EXCLUDE_ENTRIES = 50
/** Max entries in a per-site `require_file` gate. */
export const MAX_REQUIRE_FILE_ENTRIES = 10

// A deny-list glob: the subdir charset plus the glob metacharacters nginxpilot's
// matcher understands. Deliberately narrower than a full shell glob — no braces,
// no character classes — so a pattern can never smuggle YAML or path traversal.
const GLOB_PATTERN = /^[A-Za-z0-9._*?\/-]+$/

/**
 * Shared shape rules for a per-site path/glob list. `null`/`undefined` mean "inherit
 * the default"; an empty array is a real value (`exclude: []` = drop Quaykeeper's
 * `*.map`, `require_file: []` = no post-fetch gate), so it is preserved, not folded
 * back into the default. Entries are trimmed and de-duplicated, order preserved.
 */
function checkList(
    raw: unknown,
    field: string,
    maxEntries: number,
    pattern: RegExp,
    charsetMessage: string,
): ListCheck {
    if (raw === undefined || raw === null) return { ok: true, value: undefined }
    if (!Array.isArray(raw)) {
        return { ok: false, reason: 'type', message: `${field} must be an array of strings` }
    }
    if (raw.length > maxEntries) {
        return { ok: false, reason: 'count', message: `${field} allows at most ${maxEntries} entries` }
    }
    const out: string[] = []
    for (const entry of raw) {
        if (typeof entry !== 'string') {
            return { ok: false, reason: 'type', message: `every ${field} entry must be a string` }
        }
        const value = entry.trim()
        if (value === '') {
            return { ok: false, reason: 'empty', message: `${field} entries must not be blank` }
        }
        if (value.length > MAX_REF_LENGTH) {
            return { ok: false, reason: 'too_long', message: `${field} entries must be at most ${MAX_REF_LENGTH} characters` }
        }
        if (value.includes('..')) {
            return { ok: false, reason: 'traversal', message: `${field} entries must not contain ".."` }
        }
        if (value.startsWith('/')) {
            return { ok: false, reason: 'traversal', message: `${field} entries are site-relative — drop the leading "/"` }
        }
        if (!pattern.test(value) || value.includes('//')) {
            return { ok: false, reason: 'charset', message: charsetMessage }
        }
        if (!out.includes(value)) out.push(value)
    }
    return { ok: true, value: out }
}

/**
 * Validate the optional per-site `exclude` globs — extra deny patterns layered on
 * nginxpilot's built-in defaults (`.env*`, `.htaccess`, `.DS_Store`, `.git*`). `*` and
 * `?` are allowed; `[]`/`{}` are not, so a pattern stays a plain glob.
 */
export function checkExclude(raw: unknown): ListCheck {
    return checkList(
        raw,
        'exclude',
        MAX_EXCLUDE_ENTRIES,
        GLOB_PATTERN,
        'exclude entries must be relative globs of letters, digits, dots, underscores, hyphens, slashes, "*" and "?"',
    )
}

/**
 * Validate the optional per-site `require_file` gate — the files that must exist in a
 * fetched tree before nginxpilot cuts the release live. Plain relative paths only (a
 * glob would make the gate unpredictable), so a docs build can gate on `200.html` or a
 * `docs/index.html` instead of the `index.html` default.
 */
export function checkRequireFile(raw: unknown): ListCheck {
    return checkList(
        raw,
        'require_file',
        MAX_REQUIRE_FILE_ENTRIES,
        PATH_PATTERN,
        'require_file entries must be relative paths of letters, digits, dots, underscores, hyphens, and slashes',
    )
}

/**
 * Validate the optional per-site rollback depth (`keep_releases`), bounded above by the
 * owner's plan (`PlanLimits.keepReleases`) — deeper history is more disk, which is the
 * quota the plan actually sells. `null`/`undefined` inherit the plan value.
 */
export function checkKeepReleases(raw: unknown, max: number): NumberCheck {
    if (raw === undefined || raw === null) return { ok: true, value: undefined }
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
        return { ok: false, reason: 'type', message: 'keepReleases must be a whole number' }
    }
    if (raw < 1) {
        return { ok: false, reason: 'range', message: 'keepReleases must be at least 1 (the live release itself)' }
    }
    if (Number.isFinite(max) && raw > max) {
        return { ok: false, reason: 'range', message: `your plan allows at most ${max} kept releases` }
    }
    return { ok: true, value: raw }
}

/** nginxpilot's own hard floor for `source.interval` — it rejects anything faster. */
export const MIN_INTERVAL_SEC = 30
/** A week: the slowest cadence worth offering (beyond it, use the Redeploy button). */
export const MAX_INTERVAL_SEC = 7 * 24 * 60 * 60

/**
 * Validate the optional per-site poll cadence (`source.interval`). The owner's plan
 * floor is a *minimum* cadence, so a site may poll less often than it (a quiet
 * marketing page needn't be checked every minute) but never more often — the floor is
 * what the plan actually guarantees the fleet. `null`/`undefined` inherit the floor.
 */
export function checkIntervalSec(raw: unknown, planFloorSec: number): NumberCheck {
    if (raw === undefined || raw === null) return { ok: true, value: undefined }
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
        return { ok: false, reason: 'type', message: 'intervalSec must be a whole number of seconds' }
    }
    const floor = Math.max(MIN_INTERVAL_SEC, Math.floor(planFloorSec))
    if (raw < floor) {
        return {
            ok: false,
            reason: 'range',
            message: `the fastest poll cadence for your plan is every ${floor} seconds`,
        }
    }
    if (raw > MAX_INTERVAL_SEC) {
        return { ok: false, reason: 'range', message: 'the slowest poll cadence is once a week' }
    }
    return { ok: true, value: raw }
}

// ── per-site TLS mode + the raw nginx escape hatch ───────────────────────────────

/**
 * Validate an optional per-site TLS mode. `undefined`/`null`/empty normalize to
 * `undefined` (= `auto`, the default). Whether the site may carry one at all — custom
 * domains yes, subdomains no — is a cross-field rule the service owns.
 */
export function checkSiteTls(raw: string | null | undefined): TlsCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.trim()
    if (value === '') return { ok: true, value: undefined }
    if (value !== 'off' && value !== 'auto' && value !== 'required') {
        return { ok: false, reason: 'enum', message: 'tls must be "off", "auto", or "required"' }
    }
    return { ok: true, value }
}

/** Max characters in a site's raw `advanced` nginx block. */
export const MAX_ADVANCED_LENGTH = 8000
/** Max lines in a site's raw `advanced` nginx block. */
export const MAX_ADVANCED_LINES = 200

// Anything outside printable ASCII + tab. A raw nginx block is emitted verbatim into
// a YAML literal scalar and from there into a config file, so control characters (and
// in particular a bare CR or a NUL) have no legitimate use and are rejected outright.
const ADVANCED_FORBIDDEN = /[\x00-\x08\x0b-\x1f\x7f]/

/**
 * Validate the optional raw nginx `advanced` block. Shape only — the *authorization*
 * to set it at all (`PlanLimits.advancedConfig`) is the service's gate, and the
 * semantic verdict is nginxpilot's `nginx -t`, which quarantines just this one site
 * if the snippet is bad. So this check exists to keep the value renderable and free
 * of control characters, not to police nginx syntax. CRLF is normalized to LF.
 */
export function checkAdvanced(raw: string | null | undefined): SubdirCheck {
    if (raw == null) return { ok: true, value: undefined }
    const value = raw.replace(/\r\n?/g, '\n').trim()
    if (value === '') return { ok: true, value: undefined }
    if (value.length > MAX_ADVANCED_LENGTH) {
        return {
            ok: false,
            reason: 'too_long',
            message: `the advanced nginx block must be at most ${MAX_ADVANCED_LENGTH} characters`,
        }
    }
    if (value.split('\n').length > MAX_ADVANCED_LINES) {
        return {
            ok: false,
            reason: 'too_long',
            message: `the advanced nginx block must be at most ${MAX_ADVANCED_LINES} lines`,
        }
    }
    if (ADVANCED_FORBIDDEN.test(value)) {
        return {
            ok: false,
            reason: 'charset',
            message: 'the advanced nginx block must not contain control characters',
        }
    }
    return { ok: true, value }
}
