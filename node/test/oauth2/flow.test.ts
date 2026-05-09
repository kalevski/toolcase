import { describe, it, expect, vi } from 'vitest'
import { buildAuthorizeURL, exchangeCode, refreshToken, revokeToken, fetchUserinfo } from '../../src/oauth2/flow'
import { defineOAuth2Provider } from '../../src/oauth2/types'
import { OAuth2TokenError, OAuth2ProtocolError } from '../../src/errors'

const baseProvider = defineOAuth2Provider({
	authorizationEndpoint: 'https://idp.test/authorize',
	tokenEndpoint: 'https://idp.test/token',
	revocationEndpoint: 'https://idp.test/revoke',
	userinfoEndpoint: 'https://idp.test/userinfo',
	clientId: 'cid',
	clientSecret: 'csecret',
	clientAuthMethod: 'client_secret_basic'
})

const mockFetch = (status: number, body: any, headers: Record<string, string> = {}) => {
	const text = typeof body === 'string' ? body : JSON.stringify(body)
	return vi.fn(async () => new Response(text, { status, headers: { 'Content-Type': 'application/json', ...headers } })) as any
}

describe('buildAuthorizeURL', () => {

	it('emits required params', () => {
		const url = buildAuthorizeURL(baseProvider, {
			state: 'st',
			redirectUri: 'https://app.test/cb',
			scope: ['openid', 'email'],
			codeChallenge: 'ch',
			codeChallengeMethod: 'S256',
			nonce: 'n'
		})
		const u = new URL(url)
		expect(u.origin + u.pathname).toBe('https://idp.test/authorize')
		expect(u.searchParams.get('response_type')).toBe('code')
		expect(u.searchParams.get('client_id')).toBe('cid')
		expect(u.searchParams.get('redirect_uri')).toBe('https://app.test/cb')
		expect(u.searchParams.get('state')).toBe('st')
		expect(u.searchParams.get('scope')).toBe('openid email')
		expect(u.searchParams.get('code_challenge')).toBe('ch')
		expect(u.searchParams.get('code_challenge_method')).toBe('S256')
		expect(u.searchParams.get('nonce')).toBe('n')
	})

	it('uses provider.defaultScope as fallback', () => {
		const provider = defineOAuth2Provider({ ...baseProvider, defaultScope: ['profile'] })
		const url = buildAuthorizeURL(provider, { state: 's', redirectUri: 'https://app.test/cb' })
		expect(new URL(url).searchParams.get('scope')).toBe('profile')
	})

	it('throws on extraParams collision with reserved key', () => {
		expect(() => buildAuthorizeURL(baseProvider, {
			state: 's', redirectUri: 'https://app.test/cb',
			extraParams: { client_id: 'evil' }
		})).toThrow(/cannot override reserved key/)
	})

	it('appends extraParams sorted', () => {
		const url = buildAuthorizeURL(baseProvider, {
			state: 's', redirectUri: 'https://app.test/cb',
			extraParams: { z_param: '1', a_param: '2' }
		})
		const qs = url.split('?')[1]
		const aIdx = qs.indexOf('a_param')
		const zIdx = qs.indexOf('z_param')
		expect(aIdx).toBeGreaterThan(-1)
		expect(zIdx).toBeGreaterThan(aIdx)
	})
})

describe('exchangeCode', () => {

	it('happy path: parses tokens', async () => {
		const fetchImpl = mockFetch(200, {
			access_token: 'at', token_type: 'Bearer', expires_in: 3600,
			refresh_token: 'rt', id_token: 'idt', scope: 'openid email'
		})
		const tokens = await exchangeCode(baseProvider, { code: 'c', redirectUri: 'https://app.test/cb' }, { fetchImpl })
		expect(tokens.accessToken).toBe('at')
		expect(tokens.refreshToken).toBe('rt')
		expect(tokens.idToken).toBe('idt')
		expect(tokens.scope).toEqual(['openid', 'email'])
		expect(tokens.expiresAt).toBeInstanceOf(Date)
		const call = fetchImpl.mock.calls[0]
		expect(call[0]).toBe('https://idp.test/token')
		expect(call[1].method).toBe('POST')
		expect(String(call[1].body)).toContain('grant_type=authorization_code')
		expect(String(call[1].body)).toContain('code=c')
		expect(call[1].headers.Authorization).toMatch(/^Basic /)
	})

	it('client_secret_post puts credentials in body', async () => {
		const provider = defineOAuth2Provider({ ...baseProvider, clientAuthMethod: 'client_secret_post' })
		const fetchImpl = mockFetch(200, { access_token: 'at', token_type: 'Bearer' })
		await exchangeCode(provider, { code: 'c', redirectUri: 'https://app.test/cb' }, { fetchImpl })
		const call = fetchImpl.mock.calls[0]
		expect(call[1].headers.Authorization).toBeUndefined()
		expect(String(call[1].body)).toContain('client_id=cid')
		expect(String(call[1].body)).toContain('client_secret=csecret')
	})

	it('throws OAuth2TokenError on non-2xx', async () => {
		const fetchImpl = mockFetch(400, { error: 'invalid_grant', error_description: 'bad code' })
		await expect(exchangeCode(baseProvider, { code: 'c', redirectUri: 'https://app.test/cb' }, { fetchImpl })).rejects.toBeInstanceOf(OAuth2TokenError)
	})

	it('throws OAuth2ProtocolError when access_token missing', async () => {
		const fetchImpl = mockFetch(200, { token_type: 'Bearer' })
		await expect(exchangeCode(baseProvider, { code: 'c', redirectUri: 'https://app.test/cb' }, { fetchImpl })).rejects.toBeInstanceOf(OAuth2ProtocolError)
	})

	it('throws when pkceMethod set but codeVerifier missing', async () => {
		const provider = defineOAuth2Provider({ ...baseProvider, pkceMethod: 'S256' })
		const fetchImpl = mockFetch(200, { access_token: 'at' })
		await expect(exchangeCode(provider, { code: 'c', redirectUri: 'https://app.test/cb' }, { fetchImpl })).rejects.toThrow(/codeVerifier missing/)
	})
})

describe('refreshToken', () => {

	it('sends grant_type=refresh_token', async () => {
		const fetchImpl = mockFetch(200, { access_token: 'new-at', token_type: 'Bearer' })
		const tokens = await refreshToken(baseProvider, { refreshToken: 'rt' }, { fetchImpl })
		expect(tokens.accessToken).toBe('new-at')
		expect(String(fetchImpl.mock.calls[0][1].body)).toContain('grant_type=refresh_token')
		expect(String(fetchImpl.mock.calls[0][1].body)).toContain('refresh_token=rt')
	})

	it('narrows scope when provided', async () => {
		const fetchImpl = mockFetch(200, { access_token: 'a', token_type: 'Bearer' })
		await refreshToken(baseProvider, { refreshToken: 'rt', scope: ['openid'] }, { fetchImpl })
		expect(String(fetchImpl.mock.calls[0][1].body)).toContain('scope=openid')
	})
})

describe('revokeToken', () => {

	it('posts to revocation endpoint', async () => {
		const fetchImpl = mockFetch(200, '')
		await revokeToken(baseProvider, 'tk', 'access_token', { fetchImpl })
		expect(fetchImpl.mock.calls[0][0]).toBe('https://idp.test/revoke')
		expect(String(fetchImpl.mock.calls[0][1].body)).toContain('token=tk')
		expect(String(fetchImpl.mock.calls[0][1].body)).toContain('token_type_hint=access_token')
	})

	it('throws when revocationEndpoint missing', async () => {
		const provider = defineOAuth2Provider({ ...baseProvider, revocationEndpoint: undefined })
		await expect(revokeToken(provider, 'tk')).rejects.toThrow(/revocationEndpoint is required/)
	})
})

describe('fetchUserinfo', () => {

	it('GETs with bearer token', async () => {
		const fetchImpl = mockFetch(200, { sub: 'u', email: 'e@x' })
		const data = await fetchUserinfo(baseProvider, 'at', { fetchImpl })
		expect(data).toEqual({ sub: 'u', email: 'e@x' })
		expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer at')
	})

	it('throws on non-2xx', async () => {
		const fetchImpl = mockFetch(401, { error: 'invalid_token' })
		await expect(fetchUserinfo(baseProvider, 'at', { fetchImpl })).rejects.toBeInstanceOf(OAuth2TokenError)
	})
})
