import { OAuth2TokenError, OAuth2ProtocolError } from '../errors'
import { fetchWithOptions, type HttpOptions } from '../http/options'
import type { OAuth2ProviderConfig, OAuth2Tokens } from './types'
import { postForm, parseTokens, safeUpstream } from './wire'

export interface BuildAuthorizeURLInput {
	state: string
	redirectUri: string
	scope?: readonly string[]
	codeChallenge?: string
	codeChallengeMethod?: 'S256' | 'plain'
	nonce?: string
	prompt?: 'none' | 'login' | 'consent' | 'select_account' | string
	loginHint?: string
	responseMode?: 'query' | 'fragment' | 'form_post'
	extraParams?: Record<string, string>
}

export interface ExchangeCodeInput {
	code: string
	redirectUri: string
	codeVerifier?: string
}

export interface RefreshInput {
	refreshToken: string
	scope?: readonly string[]
}

const RESERVED_AUTHORIZE_PARAMS = new Set([
	'response_type', 'client_id', 'redirect_uri', 'scope', 'state',
	'code_challenge', 'code_challenge_method', 'nonce',
	'prompt', 'login_hint', 'response_mode'
])

export function buildAuthorizeURL(provider: OAuth2ProviderConfig, input: BuildAuthorizeURLInput): string {
	if (!provider.authorizationEndpoint) {
		throw new Error('provider.authorizationEndpoint is required')
	}
	const params = new URLSearchParams()
	params.set('response_type', 'code')
	params.set('client_id', provider.clientId)
	params.set('redirect_uri', input.redirectUri)
	params.set('state', input.state)
	const scope = input.scope ?? provider.defaultScope
	if (scope && scope.length > 0) params.set('scope', scope.join(' '))
	if (input.codeChallenge) {
		params.set('code_challenge', input.codeChallenge)
		params.set('code_challenge_method', input.codeChallengeMethod ?? provider.pkceMethod ?? 'S256')
	}
	if (input.nonce) params.set('nonce', input.nonce)
	if (input.prompt) params.set('prompt', input.prompt)
	if (input.loginHint) params.set('login_hint', input.loginHint)
	if (input.responseMode) params.set('response_mode', input.responseMode)
	if (input.extraParams) {
		const keys = Object.keys(input.extraParams).sort()
		for (const key of keys) {
			if (RESERVED_AUTHORIZE_PARAMS.has(key)) {
				throw new Error(`extraParams cannot override reserved key: ${key}`)
			}
			params.set(key, input.extraParams[key])
		}
	}
	const sep = provider.authorizationEndpoint.includes('?') ? '&' : '?'
	return `${provider.authorizationEndpoint}${sep}${params.toString()}`
}

export async function exchangeCode(provider: OAuth2ProviderConfig, input: ExchangeCodeInput, opts?: HttpOptions): Promise<OAuth2Tokens> {
	if (provider.pkceMethod && !input.codeVerifier) {
		throw new Error('exchangeCode: provider.pkceMethod set but codeVerifier missing')
	}
	const body = new URLSearchParams()
	body.set('grant_type', 'authorization_code')
	body.set('code', input.code)
	body.set('redirect_uri', input.redirectUri)
	if (input.codeVerifier) body.set('code_verifier', input.codeVerifier)
	const { status, body: parsed } = await postForm({ endpoint: provider.tokenEndpoint, body, provider }, opts)
	if (status < 200 || status >= 300) {
		throw new OAuth2TokenError(status, describeError(parsed) || `token exchange failed (${status})`, safeUpstream(parsed))
	}
	return parseTokens(parsed)
}

export async function refreshToken(provider: OAuth2ProviderConfig, input: RefreshInput, opts?: HttpOptions): Promise<OAuth2Tokens> {
	const body = new URLSearchParams()
	body.set('grant_type', 'refresh_token')
	body.set('refresh_token', input.refreshToken)
	if (input.scope && input.scope.length > 0) body.set('scope', input.scope.join(' '))
	const { status, body: parsed } = await postForm({ endpoint: provider.tokenEndpoint, body, provider }, opts)
	if (status < 200 || status >= 300) {
		throw new OAuth2TokenError(status, describeError(parsed) || `refresh failed (${status})`, safeUpstream(parsed))
	}
	return parseTokens(parsed)
}

export async function revokeToken(provider: OAuth2ProviderConfig, token: string, hint?: 'access_token' | 'refresh_token', opts?: HttpOptions): Promise<void> {
	if (!provider.revocationEndpoint) {
		throw new Error('provider.revocationEndpoint is required for revokeToken')
	}
	const body = new URLSearchParams()
	body.set('token', token)
	if (hint) body.set('token_type_hint', hint)
	const { status, body: parsed } = await postForm({ endpoint: provider.revocationEndpoint, body, provider }, opts)
	if (status < 200 || status >= 300) {
		throw new OAuth2TokenError(status, describeError(parsed) || `revoke failed (${status})`, safeUpstream(parsed))
	}
}

export async function fetchUserinfo(provider: OAuth2ProviderConfig, accessToken: string, opts?: HttpOptions): Promise<Record<string, unknown>> {
	if (!provider.userinfoEndpoint) {
		throw new Error('provider.userinfoEndpoint is required for fetchUserinfo')
	}
	let response: Response
	try {
		response = await fetchWithOptions(provider.userinfoEndpoint, {
			method: 'GET',
			headers: { Authorization: `Bearer ${accessToken}` }
		}, opts)
	} catch (error) {
		throw new OAuth2TokenError(0, `network error: ${(error as Error).message}`)
	}
	const text = await response.text()
	let parsed: any
	try {
		parsed = JSON.parse(text)
	} catch {
		throw new OAuth2ProtocolError('userinfo response is not valid JSON')
	}
	if (response.status < 200 || response.status >= 300) {
		throw new OAuth2TokenError(response.status, describeError(parsed) || `userinfo failed (${response.status})`, safeUpstream(parsed))
	}
	if (parsed === null || typeof parsed !== 'object') {
		throw new OAuth2ProtocolError('userinfo response is not a JSON object')
	}
	return parsed
}

function describeError(body: any): string | null {
	if (!body || typeof body !== 'object') return null
	const error = typeof body.error === 'string' ? body.error : null
	const description = typeof body.error_description === 'string' ? body.error_description : null
	if (error && description) return `${error}: ${description}`
	return error
}
