/**
 * Normalise a user-supplied size attribute into a CSS length. A bare number is
 * treated as pixels (`"320"` → `"320px"`); any other non-empty value passes
 * through verbatim so callers can use `vh` / `rem` / `%` / `calc(...)`. Returns
 * null when the value is absent or blank — the signal to fall back to the
 * stylesheet default.
 *
 * Used by the select-family components (tc-extended-select, tc-combo-box,
 * tc-phone-input, tc-icon-picker, tc-tag-input) to back their `max-height`
 * attribute, which caps how tall the option list grows before it scrolls.
 */
export function cssLength(value: string | null | undefined): string | null {
    if (value == null) return null
    const v = value.trim()
    if (v === '') return null
    return /^\d+(?:\.\d+)?$/.test(v) ? `${v}px` : v
}
