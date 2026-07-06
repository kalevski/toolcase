// Pure validation for the Config subsystem's names/keys (move_wharf_to_perch.md
// §8). No I/O — uniqueness and RESTRICT-delete checks live in the services.

/** Env-var / flag / global-var / secret key shape: UPPER_SNAKE_CASE —
 *  uppercase letters/digits/underscores, starting with an uppercase letter. */
export const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/

export function isValidKey(key: string): boolean {
    return KEY_PATTERN.test(key)
}

/** Human copy for an invalid key, shared by the client forms and error maps. */
export const KEY_SHAPE_MESSAGE =
    'Keys must be UPPER_SNAKE_CASE — uppercase letters, digits and underscores, starting with a letter (e.g. DATABASE_URL).'

/** Instance name: hostname-lite — lowercase letters/digits/hyphens, 1–63 chars,
 *  never leading/trailing hyphen (move_wharf_to_perch.md §8). */
export const INSTANCE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function isValidInstanceName(name: string): boolean {
    return INSTANCE_NAME_PATTERN.test(name)
}

/** A tag: lowercase, starts alnum, then alnum/hyphen/underscore, max 32 chars
 *  (move_wharf_to_perch.md §8). */
export const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/
export const TAG_MAX_LENGTH = 32

export function isValidTag(tag: string): boolean {
    return tag.length > 0 && tag.length <= TAG_MAX_LENGTH && TAG_PATTERN.test(tag)
}

/** A project label: same shape as a tag (lowercase, starts alnum, then
 *  alnum/hyphen/underscore), max 32 chars. Shared across instances as a plain
 *  grouping/filter dimension — no functional weight. */
export const PROJECT_MAX_LENGTH = 32

export function isValidProject(project: string): boolean {
    return project.length > 0 && project.length <= PROJECT_MAX_LENGTH && TAG_PATTERN.test(project)
}

/**
 * Normalize a request-supplied tag list: trim, drop empties, validate each,
 * dedupe (case-sensitive — tags are already lowercase-enforced). Returns the
 * clean set, or the first invalid tag's text via `invalid` for the caller to
 * reject with a 400.
 */
export function normalizeTags(input: unknown): { ok: true; tags: string[] } | { ok: false; invalid: string } {
    if (!Array.isArray(input)) return { ok: true, tags: [] }
    const seen = new Set<string>()
    for (const raw of input) {
        if (typeof raw !== 'string') return { ok: false, invalid: String(raw) }
        const tag = raw.trim()
        if (tag === '') continue
        if (!isValidTag(tag)) return { ok: false, invalid: tag }
        seen.add(tag)
    }
    return { ok: true, tags: [...seen] }
}
