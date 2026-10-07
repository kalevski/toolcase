import { Cache } from '@toolcase/base'
import { createHash, timingSafeEqual } from 'node:crypto'
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

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function isSecureUrl(raw: string, allowInsecure: boolean | undefined): boolean {
	let url: URL
	try {
		url = new URL(raw)
	} catch {
		return false
	}
	if (url.protocol === 'https:') return true
	if (allowInsecure) return url.protocol === 'http:'
	return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
}

const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000

let discoveryCache = new Cache<OIDCDiscoveryDocument>((issuer: string) => fetchDiscovery(issuer, {}), DISCOVERY_TTL_MS)

async function fetchDiscovery(issuer: string, opts: HttpOptions, allowInsecure?: boolean): Promise<OIDCDiscoveryDocument> {
	if (!isSecureUrl(issuer, allowInsecure)) {
		throw new OAuth2ProtocolError(`discovery issuer must use https: ${issuer}`)
	}
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
	for (const field of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const) {
		if (!isSecureUrl(parsed[field], allowInsecure)) {
			throw new OAuth2ProtocolError(`discovery ${field} must use https`)
		}
	}
	return parsed as OIDCDiscoveryDocument
}

export async function fetchOIDCDiscovery(issuer: string, opts: HttpOptions & { cacheTtlMs?: number; allowInsecure?: boolean } = {}): Promise<OIDCDiscoveryDocument> {
	const { cacheTtlMs, allowInsecure, ...fetchOpts } = opts
	if (!isSecureUrl(issuer, allowInsecure)) {
		throw new OAuth2ProtocolError(`discovery issuer must use https: ${issuer}`)
	}
	// Bypass the shared cache when caller supplies a custom fetchImpl or headers — these
	// are caller-specific and cannot be keyed into a shared cache without a race or
	// confused-deputy / SSRF hazard.
	if (cacheTtlMs === 0 || fetchOpts.fetchImpl !== undefined || fetchOpts.headers !== undefined) {
		return fetchDiscovery(issuer, fetchOpts, allowInsecure)
	}
	if (allowInsecure) {
		return fetchDiscovery(issuer, fetchOpts, allowInsecure)
	}
	if (typeof cacheTtlMs === 'number' && cacheTtlMs > 0) {
		discoveryCache.setMS(cacheTtlMs)
	}
	const result = await discoveryCache.get(issuer)
	if (!result) throw new OAuth2ProtocolError('discovery returned empty')
	return result
}

export function clearDiscoveryCache(issuer?: string): void {
	if (issuer) {
		discoveryCache.invalidate(issuer)
	} else {
		discoveryCache = new Cache<OIDCDiscoveryDocument>((i: string) => fetchDiscovery(i, {}), DISCOVERY_TTL_MS)
	}
}

const DEFAULT_JWKS_TTL_MS = 600_000

let jwksCache = new Cache<any>(async (jwksUri: string) => createJwksGetter(jwksUri, {}), DEFAULT_JWKS_TTL_MS)

async function createJwksGetter(jwksUri: string, opts: HttpOptions): Promise<any> {
	const j = await loadJose()
	// jose v5's createRemoteJWKSet has no custom-fetch hook (customFetch is a v6 export),
	// so we fetch the JWKS ourselves through fetchWithOptions — which honours opts.fetchImpl,
	// opts.timeoutMs (via AbortController), opts.headers and retry — then build a *local*
	// key set from the result. This keeps every caller's fetch implementation isolated.
	let response: Response
	try {
		response = await fetchWithOptions(jwksUri, { method: 'GET' }, opts)
	} catch (error) {
		throw new OIDCVerificationError(`jwks fetch failed: ${(error as Error).message}`)
	}
	if (response.status < 200 || response.status >= 300) {
		throw new OIDCVerificationError(`jwks fetch returned ${response.status}`)
	}
	let jwks: any
	try {
		jwks = await response.json()
	} catch {
		throw new OIDCVerificationError('jwks response is not valid JSON')
	}
	if (!jwks || !Array.isArray(jwks.keys)) {
		throw new OIDCVerificationError('jwks response is missing a keys array')
	}
	return j.createLocalJWKSet(jwks)
}

export function clearJwksCache(jwksUri?: string): void {
	if (jwksUri) {
		jwksCache.invalidate(jwksUri)
	} else {
		jwksCache = new Cache<any>(async (uri: string) => createJwksGetter(uri, {}), DEFAULT_JWKS_TTL_MS)
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
	http?: HttpOptions
	clientId?: string
	skipNonceCheck?: boolean
	allowInsecure?: boolean
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

const JWKS_FORCED_REFETCH_MIN_MS = 10_000

const lastForcedJwksRefetch = new Map<string, number>()

async function resolveJwks(options: VerifyIdTokenOptions, forceRefresh: boolean): Promise<any> {
	if (options.jwks) return options.jwks
	if (!options.jwksUri) {
		throw new OIDCVerificationError('verifyIdToken: jwksUri or jwks is required')
	}
	const httpOpts = options.http ?? {}
	// Bypass the shared cache when caller supplies a custom fetchImpl or headers — these
	// are caller-specific and cannot be keyed into a shared cache without a confused-deputy
	// / SSRF hazard or leaking one caller's keys to another.
	if (httpOpts.fetchImpl !== undefined || httpOpts.headers !== undefined) {
		return createJwksGetter(options.jwksUri, httpOpts)
	}
	if (forceRefresh) jwksCache.invalidate(options.jwksUri)
	if (typeof options.jwksCacheMs === 'number' && options.jwksCacheMs > 0) {
		jwksCache.setMS(options.jwksCacheMs)
	}
	const jwks = await jwksCache.get(options.jwksUri)
	if (!jwks) throw new OIDCVerificationError('jwks fetch failed')
	return jwks
}

function canRefetchJwks(options: VerifyIdTokenOptions): boolean {
	if (options.jwks || !options.jwksUri) return false
	const httpOpts = options.http ?? {}
	if (httpOpts.fetchImpl !== undefined || httpOpts.headers !== undefined) return false
	const last = lastForcedJwksRefetch.get(options.jwksUri)
	const now = Date.now()
	if (last !== undefined && now - last < JWKS_FORCED_REFETCH_MIN_MS) return false
	lastForcedJwksRefetch.set(options.jwksUri, now)
	return true
}

export async function verifyIdToken(idToken: string, options: VerifyIdTokenOptions, ctx: OIDCVerifyContext = {}): Promise<VerifiedIDToken> {
	const j = await loadJose()
	if (ctx.nonce === undefined && options.skipNonceCheck !== true) {
		throw new OIDCVerificationError('verifyIdToken: ctx.nonce is required (pass skipNonceCheck: true to opt out explicitly)')
	}
	if (!isSecureUrl(options.issuer, options.allowInsecure)) {
		throw new OIDCVerificationError('verifyIdToken: issuer must use https')
	}
	if (options.jwksUri !== undefined && !isSecureUrl(options.jwksUri, options.allowInsecure)) {
		throw new OIDCVerificationError('verifyIdToken: jwksUri must use https')
	}
	const algorithms = options.allowedAlgorithms ? [...options.allowedAlgorithms] : [...DEFAULT_ALG_LIST]
	const SYM = /^(HS\d{3}|none)$/i
	if (algorithms.some(a => SYM.test(a))) {
		throw new OIDCVerificationError('symmetric/none algorithms are not allowed for ID tokens')
	}
	const verifyOptions = {
		issuer: options.issuer,
		audience: options.audience as any,
		algorithms,
		clockTolerance: options.clockToleranceSeconds ?? 30,
		requiredClaims: ['exp', 'iat', 'sub']
	}
	let verifyResult: { payload: any; protectedHeader: any }
	try {
		try {
			verifyResult = await j.jwtVerify(idToken, await resolveJwks(options, false) as any, verifyOptions)
		} catch (error) {
			if ((error as { code?: string }).code === 'ERR_JWKS_NO_MATCHING_KEY' && canRefetchJwks(options)) {
				verifyResult = await j.jwtVerify(idToken, await resolveJwks(options, true) as any, verifyOptions)
			} else {
				throw error
			}
		}
	} catch (error) {
		if (error instanceof OIDCVerificationError) throw error
		throw new OIDCVerificationError(`signature/claims verification failed: ${(error as Error).message}`)
	}
	const { payload, protectedHeader } = verifyResult
	const expectedClientId = options.clientId ?? (typeof options.audience === 'string' ? options.audience : undefined)
	if (payload.azp !== undefined && typeof payload.azp !== 'string') {
		throw new OIDCVerificationError('azp must be a string')
	}
	if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp === undefined) {
		throw new OIDCVerificationError('azp required when aud has multiple values')
	}
	if (payload.azp !== undefined && expectedClientId !== undefined && payload.azp !== expectedClientId) {
		throw new OIDCVerificationError('azp mismatch')
	}
	if (ctx.nonce !== undefined) {
		if (typeof payload.nonce !== 'string' || !timingSafeStringEqual(payload.nonce, ctx.nonce)) {
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
	if (ctx.accessToken !== undefined) {
		if (typeof payload.at_hash !== 'string') throw new OIDCVerificationError('at_hash required but absent')
		if (!timingSafeStringEqual(computeHalfHash(ctx.accessToken, protectedHeader.alg), payload.at_hash)) throw new OIDCVerificationError('at_hash mismatch')
	}
	if (ctx.authorizationCode !== undefined) {
		if (typeof payload.c_hash !== 'string') throw new OIDCVerificationError('c_hash required but absent')
		if (!timingSafeStringEqual(computeHalfHash(ctx.authorizationCode, protectedHeader.alg), payload.c_hash)) throw new OIDCVerificationError('c_hash mismatch')
	}
	return {
		header: { alg: protectedHeader.alg, kid: protectedHeader.kid, typ: protectedHeader.typ },
		payload: payload as any,
		kid: protectedHeader.kid ?? ''
	}
}

// Maps JWT algorithm identifiers to the hash used for at_hash/c_hash per RFC 7519 §3.
// EdDSA maps to sha512 (Ed25519 convention, RFC 8037 §2.4).
// Ed448 uses SHAKE-256 internally, which has no standardised at_hash mapping —
// tokens signed with Ed448 will be rejected by this function (fail-closed).
const ALG_HASH_MAP: Readonly<Record<string, string>> = {
	RS256: 'sha256', ES256: 'sha256', PS256: 'sha256',
	RS384: 'sha384', ES384: 'sha384', PS384: 'sha384',
	RS512: 'sha512', ES512: 'sha512', PS512: 'sha512',
	EdDSA: 'sha512'
}

function computeHalfHash(value: string, alg: string): string {
	const algo = ALG_HASH_MAP[alg]
	if (!algo) throw new OIDCVerificationError(`computeHalfHash: unsupported algorithm for at_hash/c_hash: ${alg}`)
	const digest = createHash(algo).update(value).digest()
	const half = digest.subarray(0, digest.length / 2)
	return half.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function timingSafeStringEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8')
	const bufB = Buffer.from(b, 'utf8')
	// Length mismatch means definite inequality; length is not secret for hash outputs or nonces.
	if (bufA.length !== bufB.length) return false
	return timingSafeEqual(bufA, bufB)
}

export interface OidcProviderInput {
	issuer: string
	clientId: string
	clientSecret?: string
	clientAuthMethod?: ClientAuthMethod
	defaultScope?: readonly string[]
	id?: string
	fetchImpl?: typeof fetch
	allowInsecure?: boolean
}

export async function oidcProvider(opts: OidcProviderInput): Promise<OAuth2ProviderConfig> {
	const discovery = await fetchOIDCDiscovery(opts.issuer, { fetchImpl: opts.fetchImpl, allowInsecure: opts.allowInsecure })
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
