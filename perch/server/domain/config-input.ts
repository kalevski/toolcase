// Pure validation for the Config subsystem's names/keys (move_wharf_to_perch.md
// §8). No I/O — uniqueness and RESTRICT-delete checks live in the services.

/** Env-var / flag / global-var / secret key shape. Ported from wharf's
 *  `KEY_PATTERN`/`isValidKey` (`server/domain/types.ts`). */
export const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isValidKey(key: string): boolean {
    return KEY_PATTERN.test(key)
}

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
