import { Cache } from '@toolcase/base'
import { createHash } from 'node:crypto'
import { OIDCVerificationError, OAuth2ProtocolError } from '../errors'
import { fetchWithOptions, type HttpOptions } from '../http/options'
import type { OAuth2ProviderConfig, ClientAuthMethod } from './types'
import { defineOAuth2Provider } from './types'

let jose: typeof import('jose') | null = null

async function loadJose(): Promise<typeof import('jose')> {
	if (jose) return jose
	try {
		jose = await import('jose')
		return jose
	} catch {
		throw new Error('jose is required for oidc helpers — install jose@^5')
	}
}

export interface OIDCDiscoveryDocument {
	issuer: string
	authorization_endpoint: string
	token_endpoint: string
	userinfo_endpoint?: string
	revocation_endpoint?: string
	introspection_endpoint?: string
	device_authorization_endpoint?: string
	end_session_endpoint?: string
	jwks_uri: string
	response_types_supported: readonly string[]
	subject_types_supported: readonly string[]
	id_token_signing_alg_values_supported: readonly string[]
	token_endpoint_auth_methods_supported?: readonly string[]
	grant_types_supported?: readonly string[]
}

const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000

let discoveryFetchOpts: HttpOptions = {}

let discoveryCache = new Cache<OIDCDiscoveryDocument>(async (issuer: string) => fetchDiscovery(issuer, discoveryFetchOpts), DISCOVERY_TTL_MS)

async function fetchDiscovery(issuer: string, opts: HttpOptions): Promise<OIDCDiscoveryDocument> {
	const base = issuer.endsWith('/') ? issuer.slice(0, -1) : issuer
	const url = `${base}/.well-known/openid-configuration`
	let response: Response
	try {
		response = await fetchWithOptions(url, { method: 'GET' }, { retry: { retries: 2 }, ...opts })
	} catch (error) {
		throw new OAuth2ProtocolError(`discovery fetch failed: ${(error as Error).message}`)
	}
	if (response.status < 200 || response.status >= 300) {
		throw new OAuth2ProtocolError(`discovery returned ${response.status}`)
	}
	let parsed: any
	try {
		parsed = await response.json()
	} catch {
		throw new OAuth2ProtocolError('discovery response is not valid JSON')
	}
	if (!parsed || typeof parsed !== 'object') {
		throw new OAuth2ProtocolError('discovery response is not a JSON object')
	}
	if (typeof parsed.issuer !== 'string' || typeof parsed.token_endpoint !== 'string' || typeof parsed.authorization_endpoint !== 'string' || typeof parsed.jwks_uri !== 'string') {
		throw new OAuth2ProtocolError('discovery document missing required fields')
	}
	if (parsed.issuer !== base && parsed.issuer !== issuer) {
		throw new OAuth2ProtocolError(`discovery issuer mismatch: requested ${issuer}, got ${parsed.issuer}`)
	}
	return parsed as OIDCDiscoveryDocument
}

export async function fetchOIDCDiscovery(issuer: string, opts: HttpOptions & { cacheTtlMs?: number } = {}): Promise<OIDCDiscoveryDocument> {
	if (opts.cacheTtlMs === 0) {
		return fetchDiscovery(issuer, opts)
	}
	discoveryFetchOpts = opts
	if (typeof opts.cacheTtlMs === 'number' && opts.cacheTtlMs > 0) {
		discoveryCache.setMS(opts.cacheTtlMs)
	}
	const result = await discoveryCache.get(issuer)
	if (!result) throw new OAuth2ProtocolError('discovery returned empty')
	return result
}

export function clearDiscoveryCache(issuer?: string): void {
	if (issuer) {
		discoveryCache.invalidate(issuer)
	} else {
		discoveryCache = new Cache<OIDCDiscoveryDocument>(async (i: string) => fetchDiscovery(i, discoveryFetchOpts), DISCOVERY_TTL_MS)
	}
}

const DEFAULT_JWKS_TTL_MS = 600_000

let jwksCache = new Cache<any>(async (jwksUri: string) => createJwksGetter(jwksUri), DEFAULT_JWKS_TTL_MS)

async function createJwksGetter(jwksUri: string): Promise<any> {
	const j = await loadJose()
	return j.createRemoteJWKSet(new URL(jwksUri))
}

export function clearJwksCache(jwksUri?: string): void {
	if (jwksUri) {
		jwksCache.invalidate(jwksUri)
	} else {
		jwksCache = new Cache<any>(async (uri: string) => createJwksGetter(uri), DEFAULT_JWKS_TTL_MS)
	}
}

export interface VerifyIdTokenOptions {
	issuer: string
	audience: string | readonly string[]
	jwksUri?: string
	jwks?: any
	clockToleranceSeconds?: number
	jwksCacheMs?: number
	allowedAlgorithms?: readonly string[]
}

export interface OIDCVerifyContext {
	nonce?: string
	accessToken?: string
	authorizationCode?: string
	maxAgeSeconds?: number
	requiredAcr?: string
	requiredAmr?: readonly string[]
}

export interface VerifiedIDToken {
	header: { alg: string; kid?: string; typ?: string }
	payload: {
		iss: string
		sub: string
		aud: string | string[]
		exp: number
		iat: number
		nonce?: string
		auth_time?: number
		acr?: string
		amr?: string[]
		[claim: string]: unknown
	}
	kid: string
}

const DEFAULT_ALG_LIST: readonly string[] = ['RS256', 'ES256', 'EdDSA']

export async function verifyIdToken(idToken: string, options: VerifyIdTokenOptions, ctx: OIDCVerifyContext = {}): Promise<VerifiedIDToken> {
	const j = await loadJose()
	let jwks: any
	if (options.jwks) {
		jwks = options.jwks
	} else {
		if (!options.jwksUri) {
			throw new OIDCVerificationError('verifyIdToken: jwksUri or jwks is required')
		}
		if (typeof options.jwksCacheMs === 'number' && options.jwksCacheMs > 0) {
			jwksCache.setMS(options.jwksCacheMs)
		}
		jwks = await jwksCache.get(options.jwksUri)
		if (!jwks) throw new OIDCVerificationError('jwks fetch failed')
	}
	const algorithms = options.allowedAlgorithms ? [...options.allowedAlgorithms] : [...DEFAULT_ALG_LIST]
	let verifyResult: { payload: any; protectedHeader: any }
	try {
		verifyResult = await j.jwtVerify(idToken, jwks as any, {
			issuer: options.issuer,
			audience: options.audience as any,
			algorithms,
			clockTolerance: options.clockToleranceSeconds ?? 30
		})
	} catch (error) {
		throw new OIDCVerificationError(`signature/claims verification failed: ${(error as Error).message}`)
	}
	const { payload, protectedHeader } = verifyResult
	if (ctx.nonce !== undefined) {
		if (payload.nonce !== ctx.nonce) {
			throw new OIDCVerificationError('nonce mismatch')
		}
	}
	if (ctx.maxAgeSeconds !== undefined) {
		if (typeof payload.auth_time !== 'number') {
			throw new OIDCVerificationError('max_age requested but auth_time absent')
		}
		const now = Math.floor(Date.now() / 1000)
		if (now - payload.auth_time > ctx.maxAgeSeconds + (options.clockToleranceSeconds ?? 30)) {
			throw new OIDCVerificationError('auth_time exceeds max_age')
		}
	}
	if (ctx.requiredAcr !== undefined) {
		if (payload.acr !== ctx.requiredAcr) {
			throw new OIDCVerificationError('acr mismatch')
		}
	}
	if (ctx.requiredAmr !== undefined) {
		const got: string[] = Array.isArray(payload.amr) ? payload.amr : []
		for (const required of ctx.requiredAmr) {
			if (!got.includes(required)) {
				throw new OIDCVerificationError(`amr missing required value: ${required}`)
			}
		}
	}
	if (ctx.accessToken !== undefined && typeof payload.at_hash === 'string') {
		const expected = computeHalfHash(ctx.accessToken, protectedHeader.alg)
		if (expected !== payload.at_hash) {
			throw new OIDCVerificationError('at_hash mismatch')
		}
	}
	if (ctx.authorizationCode !== undefined && typeof payload.c_hash === 'string') {
		const expected = computeHalfHash(ctx.authorizationCode, protectedHeader.alg)
		if (expected !== payload.c_hash) {
			throw new OIDCVerificationError('c_hash mismatch')
		}
	}
	return {
		header: { alg: protectedHeader.alg, kid: protectedHeader.kid, typ: protectedHeader.typ },
		payload: payload as any,
		kid: protectedHeader.kid ?? ''
	}
}

function computeHalfHash(value: string, alg: string): string {
	const algoMap: Record<string, string> = {
		RS256: 'sha256', ES256: 'sha256', PS256: 'sha256', HS256: 'sha256',
		RS384: 'sha384', ES384: 'sha384', PS384: 'sha384', HS384: 'sha384',
		RS512: 'sha512', ES512: 'sha512', PS512: 'sha512', HS512: 'sha512',
		EdDSA: 'sha512'
	}
	const algo = algoMap[alg] ?? 'sha256'
	const digest = createHash(algo).update(value).digest()
	const half = digest.subarray(0, digest.length / 2)
	return half.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface OidcProviderInput {
	issuer: string
	clientId: string
	clientSecret?: string
	clientAuthMethod?: ClientAuthMethod
	defaultScope?: readonly string[]
	id?: string
	fetchImpl?: typeof fetch
}

export async function oidcProvider(opts: OidcProviderInput): Promise<OAuth2ProviderConfig> {
	const discovery = await fetchOIDCDiscovery(opts.issuer, { fetchImpl: opts.fetchImpl })
	return defineOAuth2Provider({
		id: opts.id,
		authorizationEndpoint: discovery.authorization_endpoint,
		tokenEndpoint: discovery.token_endpoint,
		revocationEndpoint: discovery.revocation_endpoint,
		introspectionEndpoint: discovery.introspection_endpoint,
		deviceAuthorizationEndpoint: discovery.device_authorization_endpoint,
		userinfoEndpoint: discovery.userinfo_endpoint,
		issuer: discovery.issuer,
		jwksUri: discovery.jwks_uri,
		endSessionEndpoint: discovery.end_session_endpoint,
		defaultScope: opts.defaultScope,
		clientId: opts.clientId,
		clientSecret: opts.clientSecret,
		clientAuthMethod: opts.clientAuthMethod
	})
}
