import { retry as baseRetry } from '@toolcase/base'

interface RetryOptions {
	retries: number
	factor: number
	minTimeout: number
	maxTimeout: number
	randomize: boolean
}

export interface HttpOptions {
	fetchImpl?: typeof fetch
	userAgent?: string
	timeoutMs?: number
	headers?: Record<string, string>
	retry?: Partial<RetryOptions> | false
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_USER_AGENT = '@toolcase/node'

export async function fetchWithOptions(input: string, init: RequestInit, opts: HttpOptions = {}): Promise<Response> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch
	if (typeof fetchImpl !== 'function') {
		throw new Error('fetch is not available in this runtime; pass HttpOptions.fetchImpl')
	}

	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
	const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT

	const baseHeaders: Record<string, string> = {
		Accept: 'application/json',
		'User-Agent': userAgent
	}
	if (init.headers) {
		Object.assign(baseHeaders, normalizeHeaders(init.headers))
	}
	if (opts.headers) {
		Object.assign(baseHeaders, opts.headers)
	}

	const doFetch = async (): Promise<Response> => {
		const controller = new AbortController()
		const externalSignal = init.signal
		const onAbort = () => controller.abort((externalSignal as any)?.reason)
		if (externalSignal) {
			if (externalSignal.aborted) controller.abort((externalSignal as any).reason)
			else externalSignal.addEventListener('abort', onAbort, { once: true })
		}
		const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
		try {
			const response = await fetchImpl(input, { ...init, headers: baseHeaders, signal: controller.signal })
			if (opts.retry && response.status >= 500) {
				const error: any = new Error(`upstream ${response.status}`)
				error.__retryable = true
				error.__response = response
				throw error
			}
			return response
		} finally {
			clearTimeout(timer)
			if (externalSignal) externalSignal.removeEventListener('abort', onAbort)
		}
	}

	if (opts.retry) {
		try {
			return await baseRetry(doFetch, opts.retry)
		} catch (error) {
			if (error && (error as any).__response instanceof Response) return (error as any).__response
			throw error
		}
	}
	return doFetch()
}

function normalizeHeaders(headers: HeadersInit): Record<string, string> {
	if (headers instanceof Headers) {
		const out: Record<string, string> = {}
		headers.forEach((value, key) => { out[key] = value })
		return out
	}
	if (Array.isArray(headers)) {
		const out: Record<string, string> = {}
		for (const [key, value] of headers) out[key] = value
		return out
	}
	return { ...(headers as Record<string, string>) }
}
