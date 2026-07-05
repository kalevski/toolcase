// Pure secret-generation domain logic (move_wharf_to_perch.md §4). Given raw
// random bytes (supplied by the caller; this module performs NO I/O and does
// NOT import node:crypto) and a spec, produce a secret string deterministically.
// Ported verbatim from wharf's `server/domain/secret-gen.ts`. Buffer is used
// only as an encoding utility (hex / base64url). Keeping the entropy source out
// of here makes generation a pure function that is trivially testable with a
// fixed byte array.

import type { SecretGenKind } from '@/server/domain/types'

/** A request to generate one secret. */
export interface SecretGenSpec {
    kind: SecretGenKind
    /** Desired output length in characters (NOT bytes). */
    length: number
    /** Override charset for `password` / `token` kinds; ignored for hex/base64. */
    charset?: string
}

// Default character sets.
// Password: upper + lower + digits + a curated set of shell/url-safe symbols.
export const DEFAULT_PASSWORD_CHARSET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-=?@^_'
// Token: url-safe alphanumerics only (upper + lower + digits).
export const DEFAULT_TOKEN_CHARSET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * How many raw random bytes are required to produce a `length`-char output for
 * the given kind:
 *  - hex:    2 hex chars per byte  → ceil(length / 2)
 *  - base64: 4 base64 chars per 3 bytes → ceil(length * 3 / 4)
 *  - password/token: one byte consumed per output char → length
 */
export function bytesNeeded(spec: SecretGenSpec): number {
    switch (spec.kind) {
        case 'hex':
            return Math.ceil(spec.length / 2)
        case 'base64':
            return Math.ceil((spec.length * 3) / 4)
        case 'password':
        case 'token':
            return spec.length
    }
}

/**
 * Deterministically map raw random `bytes` to a secret string per `spec`. The
 * caller owns entropy; this function only encodes.
 *
 * Throws RangeError if `length` is not a positive integer, or if fewer than
 * `bytesNeeded(spec)` bytes are supplied ('insufficient entropy').
 */
export function generateSecret(bytes: Uint8Array, spec: SecretGenSpec): string {
    if (!Number.isInteger(spec.length) || spec.length <= 0) {
        throw new RangeError('length must be a positive integer')
    }
    const needed = bytesNeeded(spec)
    if (bytes.length < needed) {
        throw new RangeError('insufficient entropy')
    }

    switch (spec.kind) {
        case 'hex':
            // 2 hex chars/byte; slice trims any odd trailing char to exact length.
            return Buffer.from(bytes).toString('hex').slice(0, spec.length)
        case 'base64':
            // base64url is the url-safe alphabet (no +/ , no padding); slice to length.
            return Buffer.from(bytes).toString('base64url').slice(0, spec.length)
        case 'password':
        case 'token': {
            const charset =
                spec.charset ??
                (spec.kind === 'password' ? DEFAULT_PASSWORD_CHARSET : DEFAULT_TOKEN_CHARSET)
            // An empty charset would make `byte % 0` → NaN → charset[NaN] → 'undefined'
            // (a non-secret). Refuse it outright.
            if (charset.length === 0) {
                throw new RangeError('charset must not be empty')
            }
            let out = ''
            // NOTE: byte % charset.length introduces a slight modulo bias when 256
            // is not a multiple of charset.length. Acceptable for these defaults;
            // rejection sampling would be needed for uniform cryptographic output.
            for (let i = 0; i < spec.length; i++) {
                out += charset[bytes[i] % charset.length]
            }
            return out
        }
    }
}
