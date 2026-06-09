// Usage-limit detection + sleep computation (§6.5).
// Faithful to executor.sh `compute_limit_sleep` + the limit branch.

import 'server-only'
import { config } from '@/server/config'

// Detected on STDERR ONLY (stdout stream-json can embed limit-shaped strings
// inside tool results — false positives).
const LIMIT_RE = /(usage limit|rate limit|limit reached|too many requests|429)/i

export function isLimitError(stderr: string): boolean {
    return LIMIT_RE.test(stderr)
}

/** Looks like a transient (retryable) network failure rather than a hard error. */
const TRANSIENT_RE =
    /(ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network error|timeout|temporarily unavailable|503|502|504)/i

export function isTransientError(stderr: string): boolean {
    return TRANSIENT_RE.test(stderr)
}

/**
 * Parse a reset time from Claude's output:
 *   1. `limit reached|<epoch>` (10-digit s or 13-digit ms)
 *   2. an ISO-8601 timestamp near a "reset" mention
 * Returns epoch ms, or null if nothing parseable.
 */
function parseResetTime(text: string, now: number): number | null {
    const piped = text.match(/limit reached\|(\d{10}|\d{13})/i)
    if (piped) {
        const n = Number(piped[1])
        return piped[1].length === 13 ? n : n * 1000
    }

    const epoch = text.match(/reset[^\d]{0,40}(\d{13}|\d{10})/i)
    if (epoch) {
        const n = Number(epoch[1])
        return epoch[1].length === 13 ? n : n * 1000
    }

    const iso = text.match(/reset[^\n]{0,60}?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)/i)
    if (iso) {
        const t = Date.parse(iso[1])
        if (!Number.isNaN(t) && t > now) return t
    }
    return null
}

export interface SleepPlan {
    /** ms to sleep */
    ms: number
    /** epoch ms the engine will wake */
    wakeAt: number
    /** whether the reset time was parsed (vs the fallback) */
    parsed: boolean
}

/**
 * Compute how long to sleep given the limit output. Sleeps until
 * `reset - now + LIMIT_SLEEP_BUFFER`, clamped to LIMIT_SLEEP_MAX; falls back to
 * LIMIT_SLEEP_FALLBACK when no reset is parseable.
 */
export function computeLimitSleep(text: string, now: number): SleepPlan {
    const reset = parseResetTime(text, now)
    let ms: number
    let parsed: boolean
    if (reset !== null) {
        ms = reset - now + config.limitSleepBuffer * 1000
        parsed = true
    } else {
        ms = config.limitSleepFallback * 1000
        parsed = false
    }
    if (ms < 0) ms = config.limitSleepFallback * 1000
    const maxMs = config.limitSleepMax * 1000
    if (ms > maxMs) ms = maxMs
    return { ms, wakeAt: now + ms, parsed }
}
