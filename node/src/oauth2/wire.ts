import { OAuth2TokenError, OAuth2ProtocolError } from '../errors'
import { fetchWithOptions, type HttpOptions } from '../http/options'
import type { OAuth2ProviderConfig, OAuth2Tokens, ClientAuthMethod } from './types'

export interface WireRequestInit {
	endpoint: string
	body: URLSearchParams
	provider: OAuth2ProviderConfig
	authMethod?: ClientAuthMethod
}

export async function postForm(init: WireRequestInit, opts?: HttpOptions): Promise<{ status: number; body: any }> {
	const { endpoint, body, provider } = init
	const headers: Record<string, string> = {
		'Content-Type': 'application/x-www-form-urlencoded',
		Accept: 'application/json'
	}
	const authMethod = init.authMethod ?? provider.clientAuthMethod ?? (provider.clientSecret ? 'client_secret_basic' : 'none')
	if (authMethod === 'client_secret_basic') {
		if (!provider.clientSecret) throw new Error('client_secret_basic requires clientSecret')
		const basic = Buffer.from(`${encodeRFC6749(provider.clientId)}:${encodeRFC6749(provider.clientSecret)}`).toString('base64')
		headers.Authorization = `Basic ${basic}`
	} else if (authMethod === 'client_secret_post') {
		body.set('client_id', provider.clientId)
		if (provider.clientSecret) body.set('client_secret', provider.clientSecret)
	} else {
		body.set('client_id', provider.clientId)
	}

	let response: Response
	try {
		response = await fetchWithOptions(endpoint, { method: 'POST', headers, body: body.toString() }, opts)
	} catch (error) {
		throw new OAuth2TokenError(0, `network error: ${(error as Error).message}`)
	}
	const text = await response.text()
	let parsed: any = undefined
	if (text.length > 0) {
		try {
			parsed = JSON.parse(text)
		} catch {
			parsed = undefined
		}
	}
	return { status: response.status, body: parsed }
}

export function parseTokens(body: any): OAuth2Tokens {
	if (body === null || typeof body !== 'object') {
		throw new OAuth2ProtocolError('token response is not a JSON object')
	}
	const accessToken = body.access_token
	if (typeof accessToken !== 'string' || accessToken.length === 0) {
		throw new OAuth2ProtocolError('token response missing access_token')
	}
	const tokenType = typeof body.token_type === 'string' ? body.token_type : 'Bearer'
	const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : undefined
	const idToken = typeof body.id_token === 'string' ? body.id_token : undefined
	let scope: readonly string[] | undefined
	if (typeof body.scope === 'string' && body.scope.length > 0) {
		scope = body.scope.split(' ').filter((s: string) => s.length > 0)
	}
	let expiresAt: Date | undefined
	if (typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)) {
		expiresAt = new Date(Date.now() + body.expires_in * 1000)
	}
	return { accessToken, refreshToken, idToken, tokenType, scope, expiresAt, raw: body }
}

function encodeRFC6749(value: string): string {
	return encodeURIComponent(value).replace(/%20/g, '+')
}

export function safeUpstream(body: any): unknown {
	if (!body || typeof body !== 'object') return undefined
	return { error: body.error, error_description: body.error_description }
}
