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

// ── shapes ─────────────────────────────────────────────────────────────────────

/** Why a source field was rejected (machine-readable; the service maps it to 400). */
export type SourceRejection = 'empty' | 'too_long' | 'charset' | 'traversal'

/** Result of a required-field check: the normalized value, or a typed rejection. */
export type FieldCheck =
    | { ok: true; value: string }
    | { ok: false; reason: SourceRejection; message: string }

/** Result of the optional subdir check: a normalized value (or `undefined` when omitted). */
export type SubdirCheck =
    | { ok: true; value: string | undefined }
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
