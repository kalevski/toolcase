'use client'

// The ONE client fetch stack (next-fullstack-app skill). Every data view goes
// through `apiFetch` — no ad-hoc `fetch()` in components. It gives every call:
//   - a default 10 s AbortController timeout (opt out with `timeoutMs: 0` for
//     long operations: git/exec, account verify, /usage refresh, issue import),
//   - `cache: 'no-store'`,
//   - one typed error vocabulary (`ApiError.kind`) with user-ready copy via
//     `describeApiError()`,
//   - tolerant body handling (204/empty → undefined; malformed JSON → 'parse').
//
// NOT for streams: the project event stream is a native `EventSource`
// (ProjectContext) and file downloads navigate via `window.open` — leave both
// off this helper.

export type ApiErrorKind =
    | 'unauthorized' // 401 — session missing/expired
    | 'forbidden' // 403 — role too low
    | 'notfound' // 404
    | 'server' // any other non-2xx
    | 'timeout' // AbortController deadline hit
    | 'network' // fetch rejected (offline, DNS, CORS)
    | 'parse' // 2xx but the body wasn't valid JSON

export class ApiError extends Error {
    constructor(
        public kind: ApiErrorKind,
        message: string,
        public status?: number,
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

function kindForStatus(status: number): ApiErrorKind {
    if (status === 401) return 'unauthorized'
    if (status === 403) return 'forbidden'
    if (status === 404) return 'notfound'
    return 'server'
}

export interface ApiFetchOptions extends RequestInit {
    /** Milliseconds before the request aborts. `0` disables the timeout. Default 10 000. */
    timeoutMs?: number
}

/**
 * Typed JSON fetch. Resolves with the parsed body (or `undefined` for an empty
 * 2xx response); throws `ApiError` for everything else. The server's
 * `{ error: string }` body becomes the error message when present.
 */
export async function apiFetch<T = unknown>(url: string, options: ApiFetchOptions = {}): Promise<T> {
    const { timeoutMs = 10_000, signal, ...init } = options

    const controller = new AbortController()
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
    // Honor a caller-provided signal (unmount guards) alongside the timeout.
    if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    let res: Response
    try {
        res = await fetch(url, { cache: 'no-store', ...init, signal: controller.signal })
    } catch (err) {
        if (controller.signal.aborted && !signal?.aborted) {
            throw new ApiError('timeout', `request timed out after ${timeoutMs}ms`)
        }
        if (signal?.aborted) throw err // caller-initiated abort — let it propagate as-is
        throw new ApiError('network', err instanceof Error ? err.message : 'network error')
    } finally {
        if (timer) clearTimeout(timer)
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new ApiError(kindForStatus(res.status), body.error ?? `request failed (${res.status})`, res.status)
    }

    const text = await res.text()
    if (text === '') return undefined as T
    try {
        return JSON.parse(text) as T
    } catch {
        throw new ApiError('parse', 'malformed response body', res.status)
    }
}

/** User-facing copy per error kind — specific, never "refresh the page". */
export function describeApiError(err: unknown): string {
    if (!(err instanceof ApiError)) return err instanceof Error ? err.message : String(err)
    switch (err.kind) {
        case 'unauthorized':
            return 'Your session has expired — sign in again.'
        case 'forbidden':
            return "You don't have permission to do that."
        case 'notfound':
            // The server's { error } body ('unknown project', …) is usually more
            // specific than generic copy — surface it.
            return err.message || 'Not found — it may have been deleted.'
        case 'timeout':
            return 'The server took too long to respond.'
        case 'network':
            return "Can't reach the server — check your connection."
        case 'parse':
            return 'The server returned an unexpected response.'
        default:
            return err.message
    }
}

/** Whether the failure means the session is gone (→ bounce to /login). */
export function isAuthError(err: unknown): boolean {
    return err instanceof ApiError && (err.kind === 'unauthorized' || err.kind === 'forbidden')
}
