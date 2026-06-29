// Pure slug helpers (planning §10, gap-12). A project's URL slug is
// `slugify(name)` with a numeric suffix on collision. No I/O — the caller passes
// an `exists` predicate so this stays a pure, unit-tested decision.

/** Lowercase, hyphenate non-alphanumeric runs, trim hyphens. Falls back to `project`. */
export function slugify(name: string): string {
    const slug = name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // strip diacritics
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return slug || 'project'
}

/**
 * The first available slug from `slugify(name)`: the base if free, else
 * `base-2`, `base-3`, … until `exists` returns false. Pure — `exists` is the only
 * dependency, so collision handling is unit-testable without a DB.
 */
export function uniqueSlug(name: string, exists: (slug: string) => boolean): string {
    const base = slugify(name)
    if (!exists(base)) return base
    for (let n = 2; ; n++) {
        const candidate = `${base}-${n}`
        if (!exists(candidate)) return candidate
    }
}
