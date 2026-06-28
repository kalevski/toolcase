// Short, URL-safe, collision-resistant id generator (planning §4: "short random
// strings, nanoid-style, generated in the service layer"). Each entity uses a
// short prefix so ids are self-describing in logs/audit. Server-only (uses
// node:crypto for entropy).

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

// Per-entity prefixes.
export const ID = {
    project: () => newId('prj'),
    member: () => newId('mem'),
    environment: () => newId('env'),
    instance: () => newId('inst'),
    secret: () => newId('sec'),
    envVar: () => newId('var'),
    flag: () => newId('flag'),
    flagValue: () => newId('fval'),
    note: () => newId('note'),
    dockerCommand: () => newId('dcmd'),
    backup: () => newId('bkp'),
}
