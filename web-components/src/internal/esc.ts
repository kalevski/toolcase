// Single source of truth for HTML-escaping in string-rendered markup.
// Superset of the historical per-component copies: escapes the five characters
// that are unsafe in both element-text and double-quoted attribute contexts.
export function esc(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
