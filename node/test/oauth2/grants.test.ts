import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from '@toolcase/base'
import { clientCredentialsToken, requestDeviceCode, pollDeviceToken } from '../../src/oauth2/grants'
import { defineOAuth2Provider } from '../../src/oauth2/types'
import { OAuth2TokenError } from '../../src/errors'

const provider = defineOAuth2Provider({
	authorizationEndpoint: 'https://idp.test/authorize',
	tokenEndpoint: 'https://idp.test/token',
	deviceAuthorizationEndpoint: 'https://idp.test/device',
	clientId: 'cid',
	clientSecret: 'csec',
	clientAuthMethod: 'client_secret_post'
})

const queue = (responses: Array<{ status: number; body: any }>) => {
	const fetchImpl = vi.fn(async () => {
		const next = responses.shift()
		if (!next) throw new Error('no more responses')
		return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), {
			status: next.status,
			headers: { 'Content-Type': 'application/json' }
		})
	})
	return fetchImpl as any
}

describe('clientCredentialsToken', () => {

	it('happy path with scope + audience', async () => {
		const fetchImpl = queue([{ status: 200, body: { access_token: 'at', token_type: 'Bearer', expires_in: 60 } }])
		const tokens = await clientCredentialsToken(provider, { scope: ['api:read'], audience: 'aud' }, { fetchImpl })
		expect(tokens.accessToken).toBe('at')
		const body = String(fetchImpl.mock.calls[0][1].body)
		expect(body).toContain('grant_type=client_credentials')
		expect(body).toContain('scope=api%3Aread')
		expect(body).toContain('audience=aud')
		expect(body).toContain('client_id=cid')
		expect(body).toContain('client_secret=csec')
	})

	it('throws on non-2xx', async () => {
		const fetchImpl = queue([{ status: 401, body: { error: 'invalid_client' } }])
		await expect(clientCredentialsToken(provider, undefined, { fetchImpl })).rejects.toBeInstanceOf(OAuth2TokenError)
	})
})

describe('requestDeviceCode', () => {

	it('parses RFC 8628 response', async () => {
		const fetchImpl = queue([{ status: 200, body: {
			device_code: 'dc', user_code: 'ABCD-1234',
			verification_uri: 'https://idp.test/activate',
			verification_uri_complete: 'https://idp.test/activate?user_code=ABCD-1234',
			expires_in: 900, interval: 7
		} }])
		const result = await requestDeviceCode(provider, undefined, { fetchImpl })
		expect(result.deviceCode).toBe('dc')
		expect(result.userCode).toBe('ABCD-1234')
		expect(result.intervalSeconds).toBe(7)
		expect(result.expiresAt).toBeInstanceOf(Date)
	})

	it('throws when endpoint absent', async () => {
		const noDevice = defineOAuth2Provider({ ...provider, deviceAuthorizationEndpoint: undefined })
		await expect(requestDeviceCode(noDevice)).rejects.toThrow(/does not support device flow/)
	})
})

describe('pollDeviceToken', () => {

	beforeEach(() => { vi.useFakeTimers() })
	afterEach(() => { vi.useRealTimers() })

	it('pending → slow_down → success', async () => {
		const fetchImpl = queue([
			{ status: 400, body: { error: 'authorization_pending' } },
			{ status: 400, body: { error: 'slow_down' } },
			{ status: 200, body: { access_token: 'at', token_type: 'Bearer' } }
		])
		const events = new EventEmitter()
		const observed: string[] = []
		events.on('pending', (e: any) => observed.push(`pending@${e.nextAttemptInSeconds}`))
		events.on('slow_down', (e: any) => observed.push(`slow_down@${e.newIntervalSeconds}`))

		const promise = pollDeviceToken(provider, { deviceCode: 'dc', intervalSeconds: 1, events }, { fetchImpl })
		await vi.advanceTimersByTimeAsync(1000)
		await vi.advanceTimersByTimeAsync(1000)
		await vi.advanceTimersByTimeAsync(6000)
		const tokens = await promise
		expect(tokens.accessToken).toBe('at')
		expect(observed).toContain('pending@1')
		expect(observed).toContain('slow_down@6')
	})

	it('terminal error throws', async () => {
		const fetchImpl = queue([{ status: 400, body: { error: 'expired_token' } }])
		const promise = pollDeviceToken(provider, { deviceCode: 'dc', intervalSeconds: 1 }, { fetchImpl })
		const settled = promise.catch(e => e)
		await vi.advanceTimersByTimeAsync(1000)
		const err = await settled
		expect(err).toBeInstanceOf(OAuth2TokenError)
	})

	it('honors abortSignal', async () => {
		const controller = new AbortController()
		const fetchImpl = queue([])
		const promise = pollDeviceToken(provider, { deviceCode: 'dc', intervalSeconds: 5, abortSignal: controller.signal }, { fetchImpl })
		const settled = promise.catch(e => e)
		controller.abort()
		const err = await settled
		expect(err).toBeInstanceOf(Error)
		expect((err as Error).message).toBe('aborted')
	})
})
