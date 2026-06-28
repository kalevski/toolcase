// Pure env-export renderers (planning §8.1). Renders an instance's resolved
// environment to `json` or docker-`compose` text. The `dotenv` export is NOT
// here — it reuses env-file.stringify (planning §8.1), so we do not duplicate it.
//
// PURE: no I/O. Values arrive ALREADY resolved + masked by the caller; a masked
// secret value is the placeholder string `<hidden:secretName>` (planning §3.1),
// which we render verbatim — this module never resolves or unmasks anything.

/** One key/value pair to export. Local to this module (not a shared domain type). */
export interface ExportEntry {
    key: string
    value: string
}

/**
 * Pretty JSON object `{ KEY: value }` (planning §8.1). Keys are emitted in the
 * given order, 2-space indent, with a trailing newline. JSON.stringify handles
 * all escaping (quotes, backslashes, control chars) for us.
 */
export function toJson(entries: ExportEntry[]): string {
    // Build an ordered plain object; insertion order is preserved by JSON.stringify.
    const obj: Record<string, string> = {}
    for (const { key, value } of entries) {
        obj[key] = value
    }
    return JSON.stringify(obj, null, 2) + '\n'
}

/**
 * A docker-compose `environment:` mapping block (planning §8.1). Mapping keys are
 * indented 6 spaces under a 4-space `environment:` header; every value is always
 * double-quoted with `"` and `\` escaped (so colons, spaces, `#`, etc. are safe).
 * Trailing newline.
 */
export function toCompose(entries: ExportEntry[]): string {
    const lines = ['    environment:']
    for (const { key, value } of entries) {
        lines.push(`      ${key}: "${escapeDoubleQuoted(value)}"`)
    }
    return lines.join('\n') + '\n'
}

/** Escape for a YAML double-quoted scalar: backslash first, then the quote. */
function escapeDoubleQuoted(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
