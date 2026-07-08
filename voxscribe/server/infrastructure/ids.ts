// Short, URL-safe, collision-resistant id generator. Each entity uses a short
// prefix so ids are self-describing in logs/audit. Server-only (node:crypto).

import 'server-only'
import crypto from 'node:crypto'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** A random `<prefix>_<11 base36 chars>` id (~57 bits). */
export function newId(prefix: string): string {
    const bytes = crypto.randomBytes(11)
    let out = ''
    for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
    return `${prefix}_${out}`
}

// Per-entity prefixes (spec §6.4).
export const ID = {
    transcription: () => newId('trn'),
    note: () => newId('nte'),
}
