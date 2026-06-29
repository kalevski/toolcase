// Lightweight server-side diagnostic logging. Writes a structured one-line trail
// to stdout/stderr so the container logs (`docker logs`, hosting platform stream)
// carry engine/job lifecycle for debugging. Ported from TaskForge's
// `infrastructure/server-log.ts`, rebranded `[perch]`.

import 'server-only'

type Level = 'info' | 'warn' | 'error'

/** Structured one-line server log: `[perch] <ISO> <LEVEL> <scope> — <message> {…}`. */
export function slog(level: Level, scope: string, message: string, extra?: Record<string, unknown>): void {
    const line = `[perch] ${new Date().toISOString()} ${level.toUpperCase()} ${scope} — ${message}`
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    if (extra && Object.keys(extra).length > 0) {
        fn(line, extra)
    } else {
        fn(line)
    }
}
