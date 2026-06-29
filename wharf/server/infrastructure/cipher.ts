// AES-256-GCM encryption for values at rest (secrets, notes, env literals) and
// whole-file backups (planning §11). A keyring supports rotation (gap-1): every
// ciphertext is prefixed with the id of the key that sealed it, so decrypt selects
// the right keyring entry while encrypt always writes with the newest key.
//
// String format (DB values):   v<keyId>.<b64url iv>.<b64url ciphertext>.<b64url tag>
// Binary format (backup files): "WHB1" magic | 1B idLen | id | 12B iv | 16B tag | ciphertext
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
// operator can supply a hex string, a passphrase, or `openssl rand -hex 32` and
// it always yields a valid key. The keyId is a short fingerprint of that secret.
function deriveKey(secret: string): Buffer {
    return crypto.createHash('sha256').update(secret, 'utf8').digest()
}
function keyId(secret: string): string {
    return crypto.createHash('sha256').update(secret, 'utf8').digest('hex').slice(0, 8)
}

let cachedRing: RingEntry[] | undefined

/** The keyring: current key first, then ENCRYPTION_KEY_PREV (if set + distinct). */
function ring(): RingEntry[] {
    if (cachedRing) return cachedRing
    const out: RingEntry[] = []
    const seen = new Set<string>()
    for (const secret of [config.encryptionKey, config.encryptionKeyPrev]) {
        if (!secret) continue
        const id = keyId(secret)
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ id, key: deriveKey(secret) })
    }
    if (out.length === 0) throw new CipherError('no encryption key configured (ENCRYPTION_KEY)')
    cachedRing = out
    return out
}

/** The id of the current (newest) key — stamped on each backup row (backup.key_id). */
export function currentKeyId(): string {
    return ring()[0].id
}

function findKey(id: string): Buffer {
    const entry = ring().find((e) => e.id === id)
    if (!entry) {
        throw new CipherError(
            `no keyring entry for key id '${id}' — set ENCRYPTION_KEY_PREV to the key that sealed this data`,
        )
    }
    return entry.key
}

// ── string values (DB columns) ────────────────────────────────────────────────

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

// ── whole-file (backups, §8.7) ────────────────────────────────────────────────

const MAGIC = Buffer.from('WHB1', 'ascii')

/** Seal an arbitrary byte buffer (a `VACUUM INTO` snapshot) with the current key. */
export function sealBytes(plain: Buffer): Buffer {
    const { id, key } = ring()[0]
    const idBuf = Buffer.from(id, 'ascii')
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([cipher.update(plain), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([MAGIC, Buffer.from([idBuf.length]), idBuf, iv, tag, ct])
}

/** Open a buffer sealed by {@link sealBytes}. */
export function openBytes(blob: Buffer): Buffer {
    if (blob.length < MAGIC.length + 1 || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new CipherError('not a Wharf backup blob')
    }
    let off = MAGIC.length
    const idLen = blob[off]
    off += 1
    const id = blob.subarray(off, off + idLen).toString('ascii')
    off += idLen
    const iv = blob.subarray(off, off + 12)
    off += 12
    const tag = blob.subarray(off, off + 16)
    off += 16
    const ct = blob.subarray(off)
    const key = findKey(id)
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)
        return Buffer.concat([decipher.update(ct), decipher.final()])
    } catch (err) {
        throw new CipherError(`backup decryption failed: ${(err as Error).message}`)
    }
}
