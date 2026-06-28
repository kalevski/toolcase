// Pure dotenv parse + stringify (planning §8.1). The shared serializer behind
// the .env import preview and export — no I/O, so it round-trips deterministically
// and is unit-testable without touching the filesystem. The caller dedupes the
// ordered entries that `parse` returns.

/** One `KEY=value` pair lifted from a .env document. */
export interface ParsedEnvEntry {
    key: string
    value: string
}

/**
 * Parse a .env document into ordered entries (planning §8.1). Handles:
 *  - `KEY=value` lines, with an optional leading `export ` prefix;
 *  - full-line `#` comments (after optional leading whitespace) and blank lines;
 *  - single-quoted values (literal, no escape processing);
 *  - double-quoted values (process \n \t \r \\ \" escapes);
 *  - unquoted values (trimmed).
 * Lines with no `=` or an empty key are skipped. ALL surviving entries are
 * returned in document order (the caller dedupes / last-wins).
 */
export function parse(text: string): ParsedEnvEntry[] {
    const entries: ParsedEnvEntry[] = []
    // Split on any newline flavour so CRLF documents parse cleanly.
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trimStart()
        // Blank line or a full-line comment (after optional leading whitespace).
        if (line === '' || line.startsWith('#')) continue

        // Drop an optional `export ` prefix before the key.
        const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line

        const eq = withoutExport.indexOf('=')
        if (eq === -1) continue // no assignment → skip

        const key = withoutExport.slice(0, eq).trim()
        if (key === '') continue // empty key → skip

        const rawValue = withoutExport.slice(eq + 1)
        entries.push({ key, value: parseValue(rawValue) })
    }
    return entries
}

/** Decode the raw RHS of an assignment per the quoting rules in §8.1. */
function parseValue(raw: string): string {
    const trimmed = raw.trim()
    if (trimmed.length >= 2) {
        const quote = trimmed[0]
        if (quote === "'" && trimmed.endsWith("'")) {
            // Single-quoted: literal contents, no escape processing.
            return trimmed.slice(1, -1)
        }
        if (quote === '"' && trimmed.endsWith('"')) {
            // Double-quoted: process the common backslash escapes.
            return unescapeDouble(trimmed.slice(1, -1))
        }
    }
    // Unquoted: the trimmed token.
    return trimmed
}

/** Process \n \t \r \\ \" inside a double-quoted value. */
function unescapeDouble(inner: string): string {
    let out = ''
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i]
        if (ch === '\\' && i + 1 < inner.length) {
            const next = inner[++i]
            switch (next) {
                case 'n':
                    out += '\n'
                    break
                case 't':
                    out += '\t'
                    break
                case 'r':
                    out += '\r'
                    break
                case '\\':
                    out += '\\'
                    break
                case '"':
                    out += '"'
                    break
                default:
                    // Unknown escape: keep the backslash + char verbatim.
                    out += '\\' + next
                    break
            }
        } else {
            out += ch
        }
    }
    return out
}

/**
 * Serialize entries to a .env document (planning §8.1): one `KEY=value` per line
 * plus a trailing newline. A value is double-quoted (escaping \ " and newline)
 * when it is empty OR contains whitespace, `#`, `=`, a quote, or a newline;
 * otherwise it is emitted bare. Round-trips with `parse`.
 */
export function stringify(entries: ParsedEnvEntry[]): string {
    let out = ''
    for (const { key, value } of entries) {
        out += `${key}=${needsQuoting(value) ? quoteDouble(value) : value}\n`
    }
    return out
}

/** True when a bare value would not survive `parse` unchanged. */
function needsQuoting(value: string): boolean {
    return value === '' || /[\s#="'\n]/.test(value)
}

/** Wrap in double quotes, escaping backslash, double-quote and newline. */
function quoteDouble(value: string): string {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
    return `"${escaped}"`
}
