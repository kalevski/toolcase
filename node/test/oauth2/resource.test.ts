import { describe, it, expect, vi } from 'vitest'
import { extractBearerToken, introspectToken } from '../../src/oauth2/resource'
import { defineOAuth2Provider } from '../../src/oauth2/types'
import { TokenIntrospectionError } from '../../src/errors'

describe('extractBearerToken', () => {

	it('returns the token', () => {
		expect(extractBearerToken('Bearer abc.def')).toBe('abc.def')
	})

	it('case-insensitive scheme', () => {
		expect(extractBearerToken('bearer xyz')).toBe('xyz')
		expect(extractBearerToken('BEARER xyz')).toBe('xyz')
	})

	it('tolerates extra whitespace', () => {
		expect(extractBearerToken('  Bearer    abc  ')).toBe('abc')
	})

	it('returns null when missing or malformed', () => {
		expect(extractBearerToken(undefined)).toBeNull()
		expect(extractBearerToken('')).toBeNull()
		expect(extractBearerToken('Basic abc')).toBeNull()
		expect(extractBearerToken('Bearer ')).toBeNull()
	})
})

describe('introspectToken', () => {

	const provider = defineOAuth2Provider({
		authorizationEndpoint: 'https://idp.test/authorize',
		tokenEndpoint: 'https://idp.test/token',
		introspectionEndpoint: 'https://idp.test/introspect',
		clientId: 'cid',
		clientSecret: 'cs'
	})

	const mockResponse = (status: number, body: any) => vi.fn(async () => new Response(JSON.stringify(body), {
		status, headers: { 'Content-Type': 'application/json' }
	})) as any

	it('maps RFC 7662 fields', async () => {
		const fetchImpl = mockResponse(200, {
			active: true,
			scope: 'read write',
			client_id: 'cli',
			username: 'u',
			token_type: 'Bearer',
			exp: 1700000000,
			iat: 1699996400,
			nbf: 1699996400,
			sub: 'u-1',
			aud: ['svc'],
			iss: 'https://idp.test',
			jti: 'j-1'
		})
		const result = await introspectToken(provider, { token: 'tk' }, { fetchImpl })
		expect(result.active).toBe(true)
		expect(result.scope).toEqual(['read', 'write'])
		expect(result.clientId).toBe('cli')
		expect(result.expiresAt?.getTime()).toBe(1700000000 * 1000)
		expect(result.audience).toEqual(['svc'])
	})

	it('inactive token is normal response, not error', async () => {
		const fetchImpl = mockResponse(200, { active: false })
		const result = await introspectToken(provider, { token: 'tk' }, { fetchImpl })
		expect(result.active).toBe(false)
	})

	it('non-2xx throws', async () => {
		const fetchImpl = mockResponse(401, { error: 'invalid_client' })
		await expect(introspectToken(provider, { token: 'tk' }, { fetchImpl })).rejects.toBeInstanceOf(TokenIntrospectionError)
	})

	it('missing endpoint throws', async () => {
		const noIntro = defineOAuth2Provider({ ...provider, introspectionEndpoint: undefined })
		await expect(introspectToken(noIntro, { token: 'tk' })).rejects.toBeInstanceOf(TokenIntrospectionError)
	})
})
