import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose'
import { createHash } from 'node:crypto'
import {
	verifyIdToken, fetchOIDCDiscovery, clearJwksCache, clearDiscoveryCache, oidcProvider
} from '../../src/oauth2/oidc'
import { OIDCVerificationError } from '../../src/errors'

const ISSUER = 'https://idp.test'
const AUDIENCE = 'cid'

let privateKey: CryptoKey
let publicJwk: any
let kid: string
let localJwks: any

const setupKeys = async () => {
	const pair = await generateKeyPair('RS256')
	privateKey = pair.privateKey
	publicJwk = await exportJWK(pair.publicKey)
	publicJwk.alg = 'RS256'
	publicJwk.use = 'sig'
	publicJwk.kid = 'k1'
	kid = 'k1'
	localJwks = createLocalJWKSet({ keys: [publicJwk] })
}

const signToken = async (claims: Record<string, unknown>) => {
	return await new SignJWT(claims)
		.setProtectedHeader({ alg: 'RS256', kid })
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime('5m')
		.sign(privateKey)
}

const mockJwksFetch = (jwks: any) => {
	return vi.fn(async () => new Response(JSON.stringify(jwks), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})) as any
}

beforeAll(async () => {
	await setupKeys()
})

beforeEach(() => {
	clearJwksCache()
	clearDiscoveryCache()
	const jwks = { keys: [publicJwk] }
	const fetchImpl = mockJwksFetch(jwks)
	vi.stubGlobal('fetch', fetchImpl)
})

describe('verifyIdToken', () => {

	it('verifies a valid token', async () => {
		const token = await signToken({})
		const verified = await verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks })
		expect(verified.payload.iss).toBe(ISSUER)
		expect(verified.payload.aud).toBe(AUDIENCE)
	})

	it('rejects on issuer mismatch', async () => {
		const token = await signToken({})
		await expect(verifyIdToken(token, { issuer: 'https://wrong', audience: AUDIENCE, jwks: localJwks })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('rejects on audience mismatch', async () => {
		const token = await signToken({})
		await expect(verifyIdToken(token, { issuer: ISSUER, audience: 'other', jwks: localJwks })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('rejects expired token', async () => {
		const token = await new SignJWT({})
			.setProtectedHeader({ alg: 'RS256', kid })
			.setIssuer(ISSUER).setAudience(AUDIENCE)
			.setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
			.setExpirationTime(Math.floor(Date.now() / 1000) - 100)
			.sign(privateKey)
		await expect(verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('rejects disallowed alg', async () => {
		const token = await signToken({})
		await expect(verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks, allowedAlgorithms: ['ES256'] })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('matches nonce', async () => {
		const token = await signToken({ nonce: 'n1' })
		const verified = await verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { nonce: 'n1' })
		expect(verified.payload.nonce).toBe('n1')
	})

	it('rejects nonce mismatch', async () => {
		const token = await signToken({ nonce: 'n1' })
		await expect(verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { nonce: 'wrong' })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('checks at_hash', async () => {
		const accessToken = 'at-test'
		const digest = createHash('sha256').update(accessToken).digest()
		const at_hash = digest.subarray(0, 16).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
		const token = await signToken({ at_hash })
		const verified = await verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { accessToken })
		expect(verified.payload.at_hash).toBe(at_hash)
	})

	it('rejects bad at_hash', async () => {
		const token = await signToken({ at_hash: 'wrong' })
		await expect(verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { accessToken: 'at-test' })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('enforces requiredAmr', async () => {
		const token = await signToken({ amr: ['pwd', 'mfa'] })
		const verified = await verifyIdToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { requiredAmr: ['mfa'] })
		expect(verified.payload.amr).toContain('mfa')
		const noMfa = await signToken({ amr: ['pwd'] })
		await expect(verifyIdToken(noMfa, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { requiredAmr: ['mfa'] })).rejects.toBeInstanceOf(OIDCVerificationError)
	})

	it('enforces max_age via auth_time', async () => {
		const oldToken = await signToken({ auth_time: Math.floor(Date.now() / 1000) - 3600 })
		await expect(verifyIdToken(oldToken, { issuer: ISSUER, audience: AUDIENCE, jwks: localJwks }, { maxAgeSeconds: 60 })).rejects.toBeInstanceOf(OIDCVerificationError)
	})
})

describe('fetchOIDCDiscovery', () => {

	const fetchDiscovery = (doc: any) => vi.fn(async () => new Response(JSON.stringify(doc), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})) as any

	it('fetches and parses discovery document', async () => {
		const doc = {
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/auth`,
			token_endpoint: `${ISSUER}/token`,
			jwks_uri: `${ISSUER}/jwks`,
			response_types_supported: ['code'],
			subject_types_supported: ['public'],
			id_token_signing_alg_values_supported: ['RS256']
		}
		const fetchImpl = fetchDiscovery(doc)
		const result = await fetchOIDCDiscovery(ISSUER, { fetchImpl, cacheTtlMs: 0 })
		expect(result.issuer).toBe(ISSUER)
		expect(fetchImpl.mock.calls[0][0]).toBe(`${ISSUER}/.well-known/openid-configuration`)
	})
})

describe('oidcProvider', () => {

	it('builds provider config from discovery', async () => {
		const doc = {
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/auth`,
			token_endpoint: `${ISSUER}/token`,
			userinfo_endpoint: `${ISSUER}/userinfo`,
			jwks_uri: `${ISSUER}/jwks`,
			response_types_supported: ['code'],
			subject_types_supported: ['public'],
			id_token_signing_alg_values_supported: ['RS256']
		}
		const fetchImpl = vi.fn(async () => new Response(JSON.stringify(doc), {
			status: 200, headers: { 'Content-Type': 'application/json' }
		})) as any
		clearDiscoveryCache()
		const provider = await oidcProvider({ issuer: ISSUER, clientId: 'cid', clientSecret: 'cs', fetchImpl })
		expect(provider.tokenEndpoint).toBe(`${ISSUER}/token`)
		expect(provider.jwksUri).toBe(`${ISSUER}/jwks`)
		expect(provider.clientAuthMethod).toBe('client_secret_basic')
	})
})
