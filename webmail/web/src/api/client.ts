// Thin fetch wrapper for the webmail gateway. Same-origin, cookie session (the
// httpOnly cookie is never visible here). Every mutating /api call carries the
// per-session CSRF token; a 401 on an authenticated route means "signed out".

export class ApiError extends Error {
    status: number
    code: string
    retryAfter?: number
    constructor(status: number, code: string, message: string, retryAfter?: number) {
        super(message || code)
        this.status = status
        this.code = code
        this.retryAfter = retryAfter
    }
}

let csrfToken = ''
let onUnauthorized: (() => void) | null = null

export function setCsrf(token: string): void {
    csrfToken = token
}

export function csrf(): string {
    return csrfToken
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
    onUnauthorized = fn
}

export function notifyUnauthorized(): void {
    onUnauthorized?.()
}

type RequestOptions = {
    method?: string
    body?: unknown
    /** Skip the CSRF header (login). */
    noCsrf?: boolean
    /** A 401 here is an answer (wrong password), not a signed-out session. */
    allow401?: boolean
    signal?: AbortSignal
}

export async function errorFromResponse(res: Response): Promise<ApiError> {
    let code = `http_${res.status}`
    let message = res.statusText
    let retryAfter: number | undefined
    try {
        const body = await res.json()
        if (body && typeof body === 'object') {
            if (body.error && typeof body.error === 'object') {
                code = String(body.error.code ?? code)
                message = String(body.error.message ?? message)
                if (typeof body.error.retryAfter === 'number') retryAfter = body.error.retryAfter
            } else if (typeof body.type === 'string') {
                // RFC 7807 problem details, as a JMAP server may return them.
                code = body.type
                message = String(body.detail ?? body.title ?? message)
            }
        }
    } catch {
        // not JSON — keep the status text
    }
    if (retryAfter === undefined) {
        const h = Number(res.headers.get('Retry-After'))
        if (Number.isFinite(h) && h > 0) retryAfter = h
    }
    return new ApiError(res.status, code, message, retryAfter)
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    const method = (opts.method ?? 'GET').toUpperCase()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    if (method !== 'GET' && method !== 'HEAD' && !opts.noCsrf && csrfToken) {
        headers['X-Webmail-CSRF'] = csrfToken
    }
    let res: Response
    try {
        res = await fetch(path, {
            method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            credentials: 'same-origin',
            cache: 'no-store',
            signal: opts.signal,
        })
    } catch (err) {
        if ((err as Error).name === 'AbortError') throw err
        throw new ApiError(0, 'network', (err as Error).message)
    }
    if (!res.ok) {
        const error = await errorFromResponse(res)
        if (res.status === 401 && !opts.allow401) notifyUnauthorized()
        throw error
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
}
