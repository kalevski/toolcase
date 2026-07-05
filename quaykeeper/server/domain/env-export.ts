// Pure env-export renderer (move_wharf_to_perch.md §4, §11). Renders an
// instance's resolved environment to `json` text. Ported from wharf's
// `server/domain/env-export.ts`, minus the docker-compose renderer (compose
// export is out of quaykeeper's scope — move_wharf_to_perch.md §2). The `dotenv`
// export is NOT here — it reuses `env-file.stringify`, so we do not duplicate it.
//
// PURE: no I/O. Values arrive ALREADY resolved + masked by the caller; a masked
// secret value is the placeholder string `<hidden:KEY>`, which we render
// verbatim — this module never resolves or unmasks anything.

import { shQuote } from './docker-run'

/** One key/value pair to export. Local to this module (not a shared domain type). */
export interface ExportEntry {
    key: string
    value: string
}

/**
 * POSIX-shell `export KEY='value'` lines, one per entry, single-quoted via
 * {@link shQuote} so values NEVER re-expand when sourced (`$`, backticks,
 * quotes, and newlines all survive verbatim — the failure modes of sourcing a
 * dotenv file directly). This is what the agent server's `/v1/env?format=shell`
 * serves and what the docker-run snippets' inline entrypoint sources at boot.
 */
export function toShellExports(entries: ExportEntry[]): string {
    let out = ''
    for (const { key, value } of entries) {
        out += `export ${key}=${shQuote(value)}\n`
    }
    return out
}

/**
 * Pretty JSON object `{ KEY: value }`. Keys are emitted in the given order,
 * 2-space indent, with a trailing newline. JSON.stringify handles all escaping
 * (quotes, backslashes, control chars) for us.
 */
export function toJson(entries: ExportEntry[]): string {
    // Build an ordered plain object; insertion order is preserved by JSON.stringify.
    const obj: Record<string, string> = {}
    for (const { key, value } of entries) {
        obj[key] = value
    }
    return JSON.stringify(obj, null, 2) + '\n'
}
