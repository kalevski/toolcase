'use client'

// Shared client fetch helper (copied from the blueprint). Centralizes: an abort
// timeout, a small typed `ApiErrorKind` union, and an `ApiError` callers branch on.

export type ApiErrorKind =
    | 'unauthorized'
    | 'forbidden'
    | 'notfound'
    | 'server'
    | 'timeout'
    | 'network'
    | 'parse'

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

export function kindForStatus(status: number): ApiErrorKind {
    if (status === 401) return 'unauthorized'
    if (status === 403) return 'forbidden'
    if (status === 404) return 'notfound'
    return 'server'
}

export async function apiFetch<T>(
    url: string,
    opts: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...init } = opts

    const ctrl = new AbortController()
    const timer =
        timeoutMs > 0
            ? setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
            : undefined
    if (callerSignal) {
        if (callerSignal.aborted) ctrl.abort(callerSignal.reason)
        else callerSignal.addEventListener('abort', () => ctrl.abort(callerSignal.reason), { once: true })
    }

    let res: Response
    try {
        res = await fetch(url, { cache: 'no-store', ...init, signal: ctrl.signal })
    } catch (err) {
        if (timer) clearTimeout(timer)
        if (err instanceof DOMException && err.name === 'TimeoutError') throw new ApiError('timeout')
        if (callerSignal?.aborted) throw err
        throw new ApiError('network')
    }
    if (timer) clearTimeout(timer)

    if (!res.ok) throw new ApiError(kindForStatus(res.status), res.status)

    const text = await res.text()
    if (!text) return undefined as T
    try {
        return JSON.parse(text) as T
    } catch {
        throw new ApiError('parse', res.status)
    }
}

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

export function isAuthError(err: unknown): boolean {
    return err instanceof ApiError && (err.kind === 'unauthorized' || err.kind === 'forbidden')
}
