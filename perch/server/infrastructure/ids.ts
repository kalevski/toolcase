// Short, URL-safe, collision-resistant id generator for the Config subsystem
// (move_wharf_to_perch.md §3). Ported verbatim from wharf's
// `server/infrastructure/ids.ts`: each entity uses a short prefix so ids are
// self-describing in logs/audit. Server-only (uses node:crypto for entropy).

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

// Per-entity prefixes (move_wharf_to_perch.md §3; perch_database_management.md §4).
export const ID = {
    globalVar: () => newId('gvar'),
    secret: () => newId('sec'),
    instance: () => newId('inst'),
    envVar: () => newId('var'),
    flag: () => newId('flag'),
    dbServer: () => newId('dbsrv'),
}
