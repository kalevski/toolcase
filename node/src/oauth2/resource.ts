import { TokenIntrospectionError } from '../errors'
import type { HttpOptions } from '../http/options'
import type { OAuth2ProviderConfig } from './types'
import { postForm } from './wire'

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
	if (typeof authorizationHeader !== 'string') return null
	const trimmed = authorizationHeader.trim()
	if (trimmed.length === 0) return null
	const match = /^Bearer\s+(.+)$/i.exec(trimmed)
	if (!match) return null
	const token = match[1].trim()
	return token.length > 0 ? token : null
}

export interface IntrospectInput {
	token: string
	tokenTypeHint?: 'access_token' | 'refresh_token'
}

export interface IntrospectionResponse {
	active: boolean
	scope?: readonly string[]
	clientId?: string
	username?: string
	tokenType?: string
	expiresAt?: Date
	issuedAt?: Date
	notBefore?: Date
	subject?: string
	audience?: string | readonly string[]
	issuer?: string
	jti?: string
	raw: Record<string, unknown>
}

export async function introspectToken(provider: OAuth2ProviderConfig, input: IntrospectInput, opts?: HttpOptions): Promise<IntrospectionResponse> {
	if (!provider.introspectionEndpoint) {
		throw new TokenIntrospectionError('provider.introspectionEndpoint is required')
	}
	const body = new URLSearchParams()
	body.set('token', input.token)
	if (input.tokenTypeHint) body.set('token_type_hint', input.tokenTypeHint)
	let result: { status: number; body: any }
	try {
		result = await postForm({ endpoint: provider.introspectionEndpoint, body, provider }, opts)
	} catch (error) {
		throw new TokenIntrospectionError(`introspection request failed: ${(error as Error).message}`)
	}
	const { status, body: parsed } = result
	if (status < 200 || status >= 300) {
		throw new TokenIntrospectionError(`introspection failed (${status})`)
	}
	if (!parsed || typeof parsed !== 'object') {
		throw new TokenIntrospectionError('introspection response is not a JSON object')
	}
	return mapIntrospection(parsed)
}

function mapIntrospection(raw: any): IntrospectionResponse {
	const out: IntrospectionResponse = { active: raw.active === true, raw }
	if (typeof raw.scope === 'string' && raw.scope.length > 0) {
		out.scope = raw.scope.split(' ').filter((s: string) => s.length > 0)
	}
	if (typeof raw.client_id === 'string') out.clientId = raw.client_id
	if (typeof raw.username === 'string') out.username = raw.username
	if (typeof raw.token_type === 'string') out.tokenType = raw.token_type
	if (typeof raw.exp === 'number') out.expiresAt = new Date(raw.exp * 1000)
	if (typeof raw.iat === 'number') out.issuedAt = new Date(raw.iat * 1000)
	if (typeof raw.nbf === 'number') out.notBefore = new Date(raw.nbf * 1000)
	if (typeof raw.sub === 'string') out.subject = raw.sub
	if (typeof raw.aud === 'string' || Array.isArray(raw.aud)) out.audience = raw.aud
	if (typeof raw.iss === 'string') out.issuer = raw.iss
	if (typeof raw.jti === 'string') out.jti = raw.jti
	return out
}
