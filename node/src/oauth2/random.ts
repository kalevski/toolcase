import { randomBytes, createHash } from 'node:crypto'

export interface PKCEPair {
	codeVerifier: string
	codeChallenge: string
	method: 'S256' | 'plain'
}

const MIN_RANDOM_BYTES = 16

export function generatePKCE(method: 'S256' | 'plain' = 'S256'): PKCEPair {
	if (method !== 'S256' && method !== 'plain') {
		throw new Error(`unknown PKCE method: ${method}`)
	}
	const codeVerifier = base64url(randomBytes(64))
	if (method === 'plain') {
		return { codeVerifier, codeChallenge: codeVerifier, method }
	}
	const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
	return { codeVerifier, codeChallenge, method: 'S256' }
}

export function generateState(byteLength: number = 32): string {
	if (byteLength < MIN_RANDOM_BYTES) {
		throw new Error(`generateState: byteLength must be >= ${MIN_RANDOM_BYTES}`)
	}
	return base64url(randomBytes(byteLength))
}

export function generateNonce(byteLength: number = 32): string {
	if (byteLength < MIN_RANDOM_BYTES) {
		throw new Error(`generateNonce: byteLength must be >= ${MIN_RANDOM_BYTES}`)
	}
	return base64url(randomBytes(byteLength))
}

function base64url(buffer: Buffer): string {
	return buffer.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}
