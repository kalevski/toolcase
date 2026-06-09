// Lightweight server-side diagnostic logging.
//
// Distinct from `logs.ts` (RunLogger) which writes per-run, per-task files for
// the UI terminal/telemetry. This writes to the process stdout/stderr so the
// container logs (`docker logs`, hosting platform log stream) carry a structured
// trail of engine lifecycle + API actions — handy for debugging in production.

import 'server-only'

type Level = 'info' | 'warn' | 'error'

/** Structured one-line server log: `[taskforge] <ISO> <LEVEL> <scope> — <message> {…}`. */
export function slog(level: Level, scope: string, message: string, extra?: Record<string, unknown>): void {
    const line = `[taskforge] ${new Date().toISOString()} ${level.toUpperCase()} ${scope} — ${message}`
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    if (extra && Object.keys(extra).length > 0) {
        fn(line, extra)
    } else {
        fn(line)
    }
}
