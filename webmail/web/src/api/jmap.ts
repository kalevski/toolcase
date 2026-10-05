// A thin in-house JMAP client (RFC 8620/8621) speaking to the gateway at
// /api/jmap. No mail library: request batching, back-references, upload with
// progress, and URL-template expansion are all that is needed.

import { ApiError, csrf, errorFromResponse, notifyUnauthorized } from './client'
import {
    CAP_CORE,
    CAP_MAIL,
    CAP_QUOTA,
    CAP_SUBMISSION,
    CAP_VACATION,
    type Invocation,
    type JmapSession,
} from '../jmap/types'
import { quirks } from '../jmap/quirks'

export class JmapMethodError extends Error {
    type: string
    method: string
    constructor(method: string, type: string, description?: string) {
        super(description || type)
        this.type = type
        this.method = method
    }
}

/** Expand the RFC 6570 level-1 templates in the session document. */
export function expandTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        encodeURIComponent(vars[name] ?? ''),
    )
}

export type UploadResult = { accountId: string; blobId: string; type: string; size: number }

export class JmapClient {
    readonly session: JmapSession
    readonly accountId: string
    readonly using: string[]
    private maxCalls: number

    constructor(session: JmapSession, maxCalls = 32) {
        this.session = session
        this.accountId =
            session.primaryAccounts?.[CAP_MAIL] ?? Object.keys(session.accounts ?? {})[0] ?? ''
        const caps = session.capabilities ?? {}
        this.using = [CAP_CORE, CAP_MAIL, CAP_SUBMISSION, CAP_VACATION, CAP_QUOTA].filter(
            (c) => c in caps,
        )
        if (!this.using.includes(CAP_CORE)) this.using.unshift(CAP_CORE)
        if (!this.using.includes(CAP_MAIL)) this.using.push(CAP_MAIL)
        const coreCap = caps[CAP_CORE] as { maxCallsInRequest?: number } | undefined
        this.maxCalls = Math.min(maxCalls, coreCap?.maxCallsInRequest ?? maxCalls)
    }

    has(capability: string): boolean {
        return capability in (this.session.capabilities ?? {})
    }

    /**
     * Send one JMAP request. Returns the method responses keyed by call id.
     * A method-level `error` response throws JmapMethodError, so callers can
     * treat the result as the success shape.
     */
    async request(calls: Invocation[]): Promise<Record<string, Record<string, any>>> {
        if (calls.length > this.maxCalls) {
            throw new Error(`too many method calls (${calls.length} > ${this.maxCalls})`)
        }
        const methodCalls = calls.map(([name, args, id]) => [
            name,
            { accountId: this.accountId, ...args },
            id,
        ])
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        }
        const token = csrf()
        if (token) headers['X-Webmail-CSRF'] = token
        let res: Response
        try {
            res = await fetch(this.session.apiUrl || '/api/jmap', {
                method: 'POST',
                headers,
                credentials: 'same-origin',
                cache: 'no-store',
                body: JSON.stringify({ using: this.using, methodCalls }),
            })
        } catch (err) {
            throw new ApiError(0, 'network', (err as Error).message)
        }
        if (!res.ok) {
            if (res.status === 401) notifyUnauthorized()
            throw await errorFromResponse(res)
        }
        const body = (await res.json()) as { methodResponses: Invocation[] }
        const out: Record<string, Record<string, any>> = {}
        for (const [name, args, id] of body.methodResponses ?? []) {
            if (name === 'error') {
                // The first error for a call id wins; later ones are dependants.
                if (!out[id]) {
                    const err = new JmapMethodError(
                        calls.find((c) => c[2] === id)?.[0] ?? '?',
                        String(args.type ?? 'serverFail'),
                        args.description as string | undefined,
                    )
                    throw err
                }
                continue
            }
            out[id] = args
        }
        return out
    }

    /** One call, one response. */
    async call<T = Record<string, any>>(name: string, args: Record<string, unknown>): Promise<T> {
        const r = await this.request([[name, args, '0']])
        return r['0'] as T
    }

    downloadUrl(blobId: string, name: string, type: string): string {
        return expandTemplate(this.session.downloadUrl, {
            accountId: this.accountId,
            blobId,
            name: name || 'download',
            type: type || 'application/octet-stream',
        })
    }

    eventSourceUrl(): string {
        return expandTemplate(this.session.eventSourceUrl, {
            types: quirks.eventSourceTypes,
            closeafter: 'no',
            ping: String(quirks.eventSourcePing),
        })
    }

    /** Upload a blob with progress. XHR because fetch has no upload progress. */
    upload(
        file: Blob,
        onProgress?: (fraction: number) => void,
    ): { promise: Promise<UploadResult>; abort: () => void } {
        const xhr = new XMLHttpRequest()
        const url = expandTemplate(this.session.uploadUrl, { accountId: this.accountId })
        const promise = new Promise<UploadResult>((resolve, reject) => {
            xhr.open('POST', url)
            xhr.withCredentials = true
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
            const token = csrf()
            if (token) xhr.setRequestHeader('X-Webmail-CSRF', token)
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress?.(e.loaded / e.total)
            }
            xhr.onload = () => {
                if (xhr.status === 401) notifyUnauthorized()
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText) as UploadResult)
                    } catch {
                        reject(new ApiError(xhr.status, 'bad_response', 'invalid upload response'))
                    }
                    return
                }
                let code = `http_${xhr.status}`
                let message = xhr.statusText
                try {
                    const b = JSON.parse(xhr.responseText)
                    code = b?.error?.code ?? code
                    message = b?.error?.message ?? message
                } catch {
                    // keep defaults
                }
                reject(new ApiError(xhr.status, code, message))
            }
            xhr.onerror = () => reject(new ApiError(0, 'network', 'upload failed'))
            xhr.onabort = () => reject(new ApiError(0, 'aborted', 'upload aborted'))
            xhr.send(file)
        })
        return { promise, abort: () => xhr.abort() }
    }
}

export const ref = (resultOf: string, name: string, path: string) => ({ resultOf, name, path })
