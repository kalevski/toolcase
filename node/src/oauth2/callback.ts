import { timingSafeEqual } from 'node:crypto'
import { OAuth2CallbackError } from '../errors'

export interface VerifyCallbackInput {
    stored: string
    received: string
}

/**
 * Constant-time comparison of CSRF `state` values returned by the authorization server.
 *
 * IMPORTANT: always pass `ctx.nonce` through to `verifyIdToken` as well — omitting it
 * silently skips the nonce check and leaves the flow vulnerable to replay attacks.
 *
 * @throws {OAuth2CallbackError} when lengths differ or values do not match
 */
export function verifyCallback(input: VerifyCallbackInput): void {
    const a = Buffer.from(input.stored)
    const b = Buffer.from(input.received)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new OAuth2CallbackError('state mismatch')
    }
}
