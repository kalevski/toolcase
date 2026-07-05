// AES-256-GCM encryption for secrets at rest (multiple_realms.md §B.1). The one
// secret Quaykeeper stores is a realm's nginxpilot admin token — a credential that grants
// full control of an nginx instance, so it MUST be encrypted at rest and never reach
// the client. Ported from `wharf/server/infrastructure/cipher.ts`: a small keyring
// supports rotation (every ciphertext is stamped with the id of the key that sealed
// it, so decrypt selects the right key while encrypt always writes with the newest).
//
// String format:  v<keyId>.<b64url iv>.<b64url ciphertext>.<b64url tag>
//
// Key source (§10.5): the dedicated `QUAYKEEPER_REALM_KEY` when set (recommended), else a
// key HKDF-derived from `QUAYKEEPER_AUTH_SECRET` so an existing deployment needs no new env.
// `QUAYKEEPER_REALM_KEY_PREV` keeps a rotated-out key in the ring for decrypt.
//
// Server-only; typed errors so the service layer can branch. Not in domain/.

import 'server-only'
import crypto from 'node:crypto'
import { config } from '@/server/config'

export class CipherError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'CipherError'
    }
}

interface RingEntry {
    id: string
    key: Buffer
}

// Normalize any provided secret string to a 32-byte AES key via SHA-256, so an
// operator can supply a hex string, a passphrase, or `openssl rand -hex 32` and it
// always yields a valid key. The keyId is a short fingerprint of that secret.
function deriveKey(secret: string): Buffer {
    return crypto.createHash('sha256').update(secret, 'utf8').digest()
}
function keyId(secret: string): string {
    return crypto.createHash('sha256').update(secret, 'utf8').digest('hex').slice(0, 8)
}

/**
 * The realm-key secrets, newest first. When `QUAYKEEPER_REALM_KEY` is set it (and any
 * `PREV`) are the ring; otherwise a single key is HKDF-derived from `QUAYKEEPER_AUTH_SECRET`
 * with a fixed info label, so existing deployments encrypt without a new env var while
 * keeping the key independent of the raw session secret.
 */
function secrets(): string[] {
    if (config.realmKey) {
        return [config.realmKey, config.realmKeyPrev].filter((s): s is string => !!s)
    }
    const derived = crypto.hkdfSync(
        'sha256',
        Buffer.from(config.authSecret, 'utf8'),
        Buffer.alloc(0),
        Buffer.from('quaykeeper-realm-token-v1', 'utf8'),
        32,
    )
    return [Buffer.from(derived).toString('hex')]
}

let cachedRing: RingEntry[] | undefined

/** The keyring: current key first, then any previous (for decrypt during rotation). */
function ring(): RingEntry[] {
    if (cachedRing) return cachedRing
    const out: RingEntry[] = []
    const seen = new Set<string>()
    for (const secret of secrets()) {
        if (!secret) continue
        const id = keyId(secret)
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ id, key: deriveKey(secret) })
    }
    if (out.length === 0)
        throw new CipherError(
            'no realm encryption key configured (QUAYKEEPER_REALM_KEY / QUAYKEEPER_AUTH_SECRET)',
        )
    cachedRing = out
    return out
}

function findKey(id: string): Buffer {
    const entry = ring().find((e) => e.id === id)
    if (!entry) {
        throw new CipherError(
            `no keyring entry for key id '${id}' — set QUAYKEEPER_REALM_KEY_PREV to the key that sealed this data`,
        )
    }
    return entry.key
}

/** Encrypt a UTF-8 string with the current key → `v<id>.<iv>.<ct>.<tag>`. */
export function encrypt(plaintext: string): string {
    const { id, key } = ring()[0]
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `v${id}.${iv.toString('base64url')}.${ct.toString('base64url')}.${tag.toString('base64url')}`
}

/** Decrypt a `v<id>.<iv>.<ct>.<tag>` blob back to its UTF-8 string. */
export function decrypt(blob: string): string {
    const parts = blob.split('.')
    if (parts.length !== 4 || !parts[0].startsWith('v')) {
        throw new CipherError('malformed ciphertext')
    }
    const id = parts[0].slice(1)
    const key = findKey(id)
    try {
        const iv = Buffer.from(parts[1], 'base64url')
        const ct = Buffer.from(parts[2], 'base64url')
        const tag = Buffer.from(parts[3], 'base64url')
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)
        return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    } catch (err) {
        throw new CipherError(`decryption failed: ${(err as Error).message}`)
    }
}
