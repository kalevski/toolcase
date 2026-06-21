import { EventEmitter } from '@toolcase/base'
import { OAuth2TokenError, OAuth2ProtocolError } from '../errors'
import type { HttpOptions } from '../http/options'
import type { OAuth2ProviderConfig, OAuth2Tokens } from './types'
import { postForm, parseTokens, safeUpstream } from './wire'

export interface ClientCredentialsInput {
	scope?: readonly string[]
	audience?: string
	resource?: readonly string[]
	extraParams?: Record<string, string>
}

export async function clientCredentialsToken(provider: OAuth2ProviderConfig, input: ClientCredentialsInput = {}, opts?: HttpOptions): Promise<OAuth2Tokens> {
	const body = new URLSearchParams()
	body.set('grant_type', 'client_credentials')
	if (input.scope && input.scope.length > 0) body.set('scope', input.scope.join(' '))
	if (input.audience) body.set('audience', input.audience)
	if (input.resource) for (const r of input.resource) body.append('resource', r)
	if (input.extraParams) for (const [k, v] of Object.entries(input.extraParams)) body.set(k, v)
	const { status, body: parsed } = await postForm({ endpoint: provider.tokenEndpoint, body, provider }, opts)
	if (status < 200 || status >= 300) {
		throw new OAuth2TokenError(status, describeError(parsed) || `client_credentials failed (${status})`, safeUpstream(parsed))
	}
	return parseTokens(parsed)
}

export interface DeviceCodeResponse {
	deviceCode: string
	userCode: string
	verificationUri: string
	verificationUriComplete?: string
	expiresAt: Date
	intervalSeconds: number
	raw: Record<string, unknown>
}

export async function requestDeviceCode(provider: OAuth2ProviderConfig, input: { scope?: readonly string[]; extraParams?: Record<string, string> } = {}, opts?: HttpOptions): Promise<DeviceCodeResponse> {
	if (!provider.deviceAuthorizationEndpoint) {
		throw new Error('provider does not support device flow')
	}
	const body = new URLSearchParams()
	if (input.scope && input.scope.length > 0) body.set('scope', input.scope.join(' '))
	if (input.extraParams) for (const [k, v] of Object.entries(input.extraParams)) body.set(k, v)
	const { status, body: parsed } = await postForm({ endpoint: provider.deviceAuthorizationEndpoint, body, provider }, opts)
	if (status < 200 || status >= 300) {
		throw new OAuth2TokenError(status, describeError(parsed) || `device authorization failed (${status})`, safeUpstream(parsed))
	}
	if (!parsed || typeof parsed !== 'object') {
		throw new OAuth2ProtocolError('device authorization response is not a JSON object')
	}
	const deviceCode = parsed.device_code
	const userCode = parsed.user_code
	const verificationUri = parsed.verification_uri ?? parsed.verification_url
	if (typeof deviceCode !== 'string' || typeof userCode !== 'string' || typeof verificationUri !== 'string') {
		throw new OAuth2ProtocolError('device authorization response missing device_code / user_code / verification_uri')
	}
	const expiresIn = typeof parsed.expires_in === 'number' ? parsed.expires_in : 600
	const intervalSeconds = typeof parsed.interval === 'number' && parsed.interval > 0 ? parsed.interval : 5
	return {
		deviceCode,
		userCode,
		verificationUri,
		verificationUriComplete: typeof parsed.verification_uri_complete === 'string' ? parsed.verification_uri_complete : undefined,
		expiresAt: new Date(Date.now() + expiresIn * 1000),
		intervalSeconds,
		raw: parsed
	}
}

export type DevicePollEvent =
	| { type: 'pending'; nextAttemptInSeconds: number }
	| { type: 'slow_down'; newIntervalSeconds: number }
	| { type: 'interval_changed'; intervalSeconds: number }

export interface PollDeviceTokenInput {
	deviceCode: string
	intervalSeconds?: number
	abortSignal?: AbortSignal
	events?: EventEmitter
}

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

export async function pollDeviceToken(provider: OAuth2ProviderConfig, input: PollDeviceTokenInput, opts?: HttpOptions): Promise<OAuth2Tokens> {
	let interval = input.intervalSeconds && input.intervalSeconds > 0 ? input.intervalSeconds : 5
	const events = input.events
	while (true) {
		if (input.abortSignal?.aborted) throw new Error('aborted')
		await sleep(interval * 1000, input.abortSignal)
		const body = new URLSearchParams()
		body.set('grant_type', DEVICE_GRANT)
		body.set('device_code', input.deviceCode)
		const { status, body: parsed } = await postForm({ endpoint: provider.tokenEndpoint, body, provider }, opts)
		if (status >= 200 && status < 300) {
			return parseTokens(parsed)
		}
		const errCode = parsed && typeof parsed === 'object' ? parsed.error : undefined
		if (errCode === 'authorization_pending') {
			events?.emit('pending', { type: 'pending', nextAttemptInSeconds: interval } as DevicePollEvent)
			continue
		}
		if (errCode === 'slow_down') {
			interval = interval + 5
			events?.emit('slow_down', { type: 'slow_down', newIntervalSeconds: interval } as DevicePollEvent)
			events?.emit('interval_changed', { type: 'interval_changed', intervalSeconds: interval } as DevicePollEvent)
			continue
		}
		throw new OAuth2TokenError(status, describeError(parsed) || `device token failed (${status})`, safeUpstream(parsed))
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error('aborted'))
			return
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			reject(new Error('aborted'))
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

function describeError(body: any): string | null {
	if (!body || typeof body !== 'object') return null
	const error = typeof body.error === 'string' ? body.error : null
	const description = typeof body.error_description === 'string' ? body.error_description : null
	if (error && description) return `${error}: ${description}`
	return error
}
