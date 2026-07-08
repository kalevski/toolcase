// Lightweight server-side diagnostic logging. Writes a structured one-line
// trail to stdout/stderr so the container logs carry worker/job lifecycle.

import 'server-only'

type Level = 'info' | 'warn' | 'error'

/** Structured one-line server log: `[voxscribe] <ISO> <LEVEL> <scope> — <message> {…}`. */
export function slog(level: Level, scope: string, message: string, extra?: Record<string, unknown>): void {
    const line = `[voxscribe] ${new Date().toISOString()} ${level.toUpperCase()} ${scope} — ${message}`
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    if (extra && Object.keys(extra).length > 0) {
        fn(line, extra)
    } else {
        fn(line)
    }
}
