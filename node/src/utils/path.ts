/**
 * Normalizes an HTTP path prefix:
 * - Empty / `/` → `''` (no prefix)
 * - Adds leading `/` if missing
 * - Strips trailing `/` if present and length > 1
 */
export function normalizePrefix(value: string | undefined): string {
    if (!value || value === '/' || value === '') return ''
    const withSlash = value.startsWith('/') ? value : `/${value}`
    if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1)
    return withSlash
}
