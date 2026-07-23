// Site-removal queue repository — all SQL for the `site_removal` table. A row is a
// fragment the daemon should no longer hold but whose DELETE wasn't confirmed (a
// forced site delete with the daemon unreachable, a rehost retracting the old
// domain). The status poll's reconcile pass retries each row against its realm and
// deletes it once the daemon confirms. Raw SQL only; the retry policy lives in
// `services/deploy.ts`.

import 'server-only'
import { prep, allRows } from '@/server/data/db'

/** One pending fragment removal, keyed (realmId, domain). */
export interface PendingRemoval {
    realmId: string
    domain: string
    /** Why the fragment must go: `delete` (site removed) | `rehost` (old hostname). */
    reason: string
    /** Retry count so far (observability only — rows retry until they succeed). */
    attempts: number
    createdAt: string
    updatedAt: string
}

interface Raw {
    realm_id: string
    domain: string
    reason: string
    attempts: number
    created_at: string
    updated_at: string
}

function map(r: Raw): PendingRemoval {
    return {
        realmId: r.realm_id,
        domain: r.domain,
        reason: r.reason,
        attempts: r.attempts,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

/** Queue (or refresh) a pending removal. Idempotent per (realm, domain). */
export function enqueue(realmId: string, domain: string, reason: string, at: string): void {
    prep(
        `INSERT INTO site_removal (realm_id, domain, reason, attempts, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT(realm_id, domain) DO UPDATE SET reason = excluded.reason, updated_at = excluded.updated_at`,
    ).run(realmId, domain, reason, at, at)
}

/** Every pending removal for one realm, oldest first. */
export function listByRealm(realmId: string): PendingRemoval[] {
    return allRows<Raw>(
        'SELECT * FROM site_removal WHERE realm_id = ? ORDER BY created_at',
        realmId,
    ).map(map)
}

/** Drop a pending removal (the daemon confirmed, or a new site claimed the domain). */
export function remove(realmId: string, domain: string): void {
    prep('DELETE FROM site_removal WHERE realm_id = ? AND domain = ?').run(realmId, domain)
}

/** Record one more failed retry (observability; the row keeps retrying). */
export function bumpAttempts(realmId: string, domain: string, at: string): void {
    prep('UPDATE site_removal SET attempts = attempts + 1, updated_at = ? WHERE realm_id = ? AND domain = ?').run(
        at,
        realmId,
        domain,
    )
}
