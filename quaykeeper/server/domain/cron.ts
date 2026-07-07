// Pure 5-field cron parser/matcher — no `server-only`, no I/O — so the scheduled
// boot tickers (quota sweep, status poll) stay thin and the parsing
// rules are unit-testable in isolation. Ported from TaskForge's
// `services/scheduler.ts` cron subset (the §8 "mirror TaskForge's scheduler cron
// pattern" requirement).
//
// Cron subset: 5 fields `min hour dom mon dow` supporting `*`, numbers, lists
// `a,b`, ranges `a-b`, and steps `*/n`. dow: 0–6, 0 = Sunday (7 ≡ 0).

export class InvalidCronError extends Error {}

/** Parse one cron field into a matcher over [min, max]. Throws on bad syntax. */
function fieldMatcher(field: string, min: number, max: number): (v: number) => boolean {
    const norm = (n: number) => (max === 6 && n === 7 ? 0 : n) // dow: 7 ≡ 0 (Sunday)
    const parts = field.split(',')
    const accept = new Set<number>()
    for (const part of parts) {
        const step = part.match(/^(\*|\d+-\d+)\/(\d+)$/)
        if (step) {
            const n = Number(step[2])
            if (!Number.isInteger(n) || n < 1) throw new InvalidCronError(`bad step: ${part}`)
            let lo = min
            let hi = max
            if (step[1] !== '*') {
                const [a, b] = step[1].split('-').map(Number)
                lo = a
                hi = b
            }
            if (lo < min || hi > max + (max === 6 ? 1 : 0) || lo > hi) throw new InvalidCronError(`out of range: ${part}`)
            for (let v = lo; v <= hi; v += n) accept.add(norm(v))
            continue
        }
        if (part === '*') {
            for (let v = min; v <= max; v++) accept.add(v)
            continue
        }
        const range = part.match(/^(\d+)-(\d+)$/)
        if (range) {
            const a = Number(range[1])
            const b = Number(range[2])
            if (a < min || b > max + (max === 6 ? 1 : 0) || a > b) throw new InvalidCronError(`out of range: ${part}`)
            for (let v = a; v <= b; v++) accept.add(norm(v))
            continue
        }
        if (/^\d+$/.test(part)) {
            const v = Number(part)
            if (v < min || v > max + (max === 6 ? 1 : 0)) throw new InvalidCronError(`out of range: ${part}`)
            accept.add(norm(v))
            continue
        }
        throw new InvalidCronError(`bad field part: ${JSON.stringify(part)}`)
    }
    return (v) => accept.has(v)
}

export interface CronSpec {
    matches: (d: Date) => boolean
}

/** Parse a 5-field cron expression; throws InvalidCronError on bad input. */
export function parseCron(expr: string): CronSpec {
    const fields = expr.trim().split(/\s+/)
    if (fields.length !== 5) throw new InvalidCronError('cron must have 5 fields: min hour dom mon dow')
    const [minute, hour, dom, mon, dow] = [
        fieldMatcher(fields[0], 0, 59),
        fieldMatcher(fields[1], 0, 23),
        fieldMatcher(fields[2], 1, 31),
        fieldMatcher(fields[3], 1, 12),
        fieldMatcher(fields[4], 0, 6),
    ]
    const domIsStar = fields[2] === '*'
    const dowIsStar = fields[4] === '*'
    return {
        matches(d: Date): boolean {
            if (!minute(d.getMinutes()) || !hour(d.getHours()) || !mon(d.getMonth() + 1)) return false
            // Standard cron: when both dom and dow are restricted, either may match.
            const domOk = dom(d.getDate())
            const dowOk = dow(d.getDay())
            if (domIsStar && dowIsStar) return true
            if (domIsStar) return dowOk
            if (dowIsStar) return domOk
            return domOk || dowOk
        },
    }
}

/**
 * The next minute at or after `from` (exclusive of `from`'s own minute) that the
 * expression fires — or `null` if none in the search horizon. Pure, so the "next
 * run" the jobs UI previews is the same computation the scheduler ticker uses.
 *
 * Walks minute by minute from the top of the minute after `from`, capped at
 * `horizonMinutes` (default ~366 days) so an unsatisfiable field combination
 * (e.g. Feb 30) terminates instead of looping forever. Seconds/millis of the
 * returned Date are zeroed — cron resolution is one minute.
 */
export function nextRun(spec: CronSpec, from: Date, horizonMinutes = 366 * 24 * 60): Date | null {
    const d = new Date(from.getTime())
    d.setSeconds(0, 0)
    d.setMinutes(d.getMinutes() + 1) // strictly after `from`'s minute
    for (let i = 0; i < horizonMinutes; i++) {
        if (spec.matches(d)) return new Date(d.getTime())
        d.setMinutes(d.getMinutes() + 1)
    }
    return null
}
