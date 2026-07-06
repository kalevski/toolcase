// Realm repository — all SQL for the `realm` table (multiple_realms.md §B.2). One
// registered nginxpilot instance per row. The encrypted admin token (`token_enc`) is
// kept server-side only: this repo returns a {@link StoredRealm} that carries the
// ciphertext, and the service masks it to the client `Realm` DTO (which exposes only
// `hasToken`). Business rules (URL validation, the one-default invariant beyond the DB
// index, removal guards) live in `services/realms.ts`.

import 'server-only'
import { prep, getRow, allRows, tx } from '@/server/data/db'

/**
 * A realm row as stored — includes the encrypted token (`tokenEnc`, NULL = unauthenticated
 * instance). Server-only; never serialized to a client. The service decrypts `tokenEnc`
 * into a `RealmConnection` and masks the rest to the `Realm` DTO.
 */
export interface StoredRealm {
    id: string
    name: string
    adminUrl: string
    tokenEnc: string | null
    isDefault: boolean
    createdAt: string
}

interface Raw {
    id: string
    name: string
    admin_url: string
    token_enc: string | null
    is_default: number
    created_at: string
}

function map(r: Raw): StoredRealm {
    return {
        id: r.id,
        name: r.name,
        adminUrl: r.admin_url,
        tokenEnc: r.token_enc,
        isDefault: r.is_default === 1,
        createdAt: r.created_at,
    }
}

/** Every realm, oldest first. */
export function list(): StoredRealm[] {
    return allRows<Raw>('SELECT * FROM realm ORDER BY created_at').map(map)
}

/** One realm by id, or undefined. */
export function byId(id: string): StoredRealm | undefined {
    const r = getRow<Raw>('SELECT * FROM realm WHERE id = ?', id)
    return r ? map(r) : undefined
}

/** The single default realm, or undefined before any realm is seeded. */
export function getDefault(): StoredRealm | undefined {
    const r = getRow<Raw>('SELECT * FROM realm WHERE is_default = 1 LIMIT 1')
    return r ? map(r) : undefined
}

/** Total realm count (the seed gate: only seed when the table is empty). */
export function count(): number {
    return getRow<{ n: number }>('SELECT COUNT(*) AS n FROM realm')?.n ?? 0
}

/**
 * Insert a realm. `tokenEnc` is the AES-256-GCM ciphertext (NULL = unauthenticated).
 * `isDefault` should only be set when no other default exists (the partial unique index
 * `idx_realm_one_default` enforces this at the DB layer); use {@link setDefault} to switch.
 */
export function create(
    realm: { id: string; name: string; adminUrl: string; isDefault: boolean; createdAt: string },
    tokenEnc: string | null,
): void {
    prep(
        `INSERT INTO realm (id, name, admin_url, token_enc, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(realm.id, realm.name, realm.adminUrl, tokenEnc, realm.isDefault ? 1 : 0, realm.createdAt)
}

/** Rename a realm. No-op on an unknown id. */
export function rename(id: string, name: string): void {
    prep('UPDATE realm SET name = ? WHERE id = ?').run(name, id)
}

/** Rotate (or clear, with `null`) a realm's encrypted admin token. */
export function setToken(id: string, tokenEnc: string | null): void {
    prep('UPDATE realm SET token_enc = ? WHERE id = ?').run(tokenEnc, id)
}

/**
 * Make `id` the single default realm — clear the current default, then set the new one,
 * in one transaction so the partial unique index never sees two defaults mid-swap.
 */
export function setDefault(id: string): void {
    tx(() => {
        prep('UPDATE realm SET is_default = 0 WHERE is_default = 1').run()
        prep('UPDATE realm SET is_default = 1 WHERE id = ?').run(id)
    })
}

/** Delete a realm row. The caller (service) enforces the removal guards first (§9). */
export function remove(id: string): void {
    prep('DELETE FROM realm WHERE id = ?').run(id)
}
