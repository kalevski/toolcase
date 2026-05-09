import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { generatePKCE, generateState, generateNonce } from '../../src/oauth2/random'

const BASE64URL = /^[A-Za-z0-9_-]+$/

describe('generatePKCE', () => {

	it('returns S256 pair by default', () => {
		const pair = generatePKCE()
		expect(pair.method).toBe('S256')
		expect(pair.codeVerifier).toMatch(BASE64URL)
		expect(pair.codeChallenge).toMatch(BASE64URL)
		expect(pair.codeChallenge).not.toBe(pair.codeVerifier)
	})

	it('S256 challenge equals base64url(sha256(verifier))', () => {
		const pair = generatePKCE('S256')
		const expected = createHash('sha256').update(pair.codeVerifier).digest('base64')
			.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
		expect(pair.codeChallenge).toBe(expected)
	})

	it('plain mode: challenge equals verifier', () => {
		const pair = generatePKCE('plain')
		expect(pair.method).toBe('plain')
		expect(pair.codeChallenge).toBe(pair.codeVerifier)
	})

	it('rejects unknown method', () => {
		expect(() => generatePKCE('S512' as any)).toThrow(/unknown PKCE method/)
	})

	it('verifier matches RFC 7636 length range', () => {
		const pair = generatePKCE()
		expect(pair.codeVerifier.length).toBeGreaterThanOrEqual(43)
		expect(pair.codeVerifier.length).toBeLessThanOrEqual(128)
	})
})

describe('generateState / generateNonce', () => {

	it('default length, base64url alphabet', () => {
		const s = generateState()
		const n = generateNonce()
		expect(s).toMatch(BASE64URL)
		expect(n).toMatch(BASE64URL)
	})

	it('rejects byteLength < 16', () => {
		expect(() => generateState(8)).toThrow(/byteLength must be >= 16/)
		expect(() => generateNonce(8)).toThrow(/byteLength must be >= 16/)
	})

	it('produces distinct values across many calls', () => {
		const set = new Set(Array.from({ length: 50 }, () => generateState()))
		expect(set.size).toBe(50)
	})
})
