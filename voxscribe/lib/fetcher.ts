'use client'

// Shared client fetch helper (plan WS-3). Every data view in the app used to
// `fetch(url, { cache: 'no-store' })` ad-hoc, with no timeout (a hung request
// hangs the UI forever) and a single generic "couldn't load" fallback that
// collapsed 401 / 403 / 5xx / offline into one message. `apiFetch` centralises
// that: it aborts on a timeout, classifies the failure into a small `ApiErrorKind`
// union, and throws a typed `ApiError` callers can branch on (redirect on
// `unauthorized`, show a retry on `server`/`timeout`/`network`, etc.).

export type ApiErrorKind =
    | 'unauthorized' // 401 — session expired / not signed in
    | 'forbidden' // 403 — signed in but not provisioned / wrong role
    | 'notfound' // 404 — resource gone
    | 'server' // 5xx / other non-OK
    | 'timeout' // request exceeded the deadline
    | 'network' // fetch rejected (offline, DNS, CORS, …)
    | 'parse' // 2xx but the body wasn't the JSON we expected

export class ApiError extends Error {
    constructor(
        readonly kind: ApiErrorKind,
        readonly status?: number,
    ) {
        super(kind)
        this.name = 'ApiError'
    }
}

const DEFAULT_TIMEOUT_MS = 10_000

/** Classify a non-OK HTTP status into an `ApiErrorKind`. */
export function kindForStatus(status: number): ApiErrorKind {
    if (status === 401) return 'unauthorized'
    if (status === 403) return 'forbidden'
    if (status === 404) return 'notfound'
    return 'server'
}

/**
 * Fetch JSON with a timeout and typed errors. Rejects with an {@link ApiError}
 * on any non-2xx status, a timeout, a network failure, or a body that can't be
 * parsed as JSON. Pass `timeoutMs: 0` to disable the deadline.
 */
export async function apiFetch<T>(
    url: string,
    opts: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...init } = opts

    const ctrl = new AbortController()
    const timer =
        timeoutMs > 0 ? setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs) : undefined
    // Honour a caller-supplied signal too (e.g. unmount cancellation): abort our
    // controller when theirs fires so the in-flight request is cancelled.
    if (callerSignal) {
        if (callerSignal.aborted) ctrl.abort(callerSignal.reason)
        else callerSignal.addEventListener('abort', () => ctrl.abort(callerSignal.reason), { once: true })
    }

    let res: Response
    try {
        res = await fetch(url, { cache: 'no-store', ...init, signal: ctrl.signal })
    } catch (err) {
        if (timer) clearTimeout(timer)
        // A timeout abort surfaces as our TimeoutError; anything else aborting is a
        // caller cancellation, which we re-throw so the caller's `cancelled` guard
        // can ignore it. A plain rejection is a network failure.
        if (err instanceof DOMException && err.name === 'TimeoutError') throw new ApiError('timeout')
        if (callerSignal?.aborted) throw err
        throw new ApiError('network')
    }
    if (timer) clearTimeout(timer)

    if (!res.ok) throw new ApiError(kindForStatus(res.status), res.status)

    // 204 and other empty bodies parse as undefined — callers that expect data on
    // a 2xx should not hit this, but tolerate an empty body as `undefined as T`.
    const text = await res.text()
    if (!text) return undefined as T
    try {
        return JSON.parse(text) as T
    } catch {
        throw new ApiError('parse', res.status)
    }
}

/** Human copy for an error surfaced to the user. Specific per kind, never "refresh the page". */
export function describeApiError(err: unknown): string {
    const kind = err instanceof ApiError ? err.kind : 'network'
    switch (kind) {
        case 'unauthorized':
            return 'Your session expired. Sign in again to continue.'
        case 'forbidden':
            return 'You don’t have access to this.'
        case 'notfound':
            return 'We couldn’t find what you were looking for.'
        case 'timeout':
            return 'The server took too long to respond.'
        case 'server':
            return 'The server hit an error. This is usually temporary.'
        case 'parse':
            return 'The server sent back something we couldn’t read.'
        case 'network':
        default:
            return 'We couldn’t reach the server. Check your connection.'
    }
}

/** True when the failure means the caller should bounce to `/login`. */
export function isAuthError(err: unknown): boolean {
    return err instanceof ApiError && (err.kind === 'unauthorized' || err.kind === 'forbidden')
}
