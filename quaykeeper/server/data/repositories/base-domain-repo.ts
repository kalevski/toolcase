// Base-domain repository — all SQL for the `base_domain` table (§10, §12).
// The owner-managed subdomain pool: every registered base domain backs
// `<label>.<domain>` subdomain sites. Raw-SQL list/add/remove only; label
// validation and reserved-word blocking live in a service.

import 'server-only'
import { prep, allRows, getRow } from '@/server/data/db'
import type { BaseDomain, BaseDomainTls } from '@/server/domain/types'

interface Raw {
    domain: string
    tls: string
    realm_id: string
    created_at: string
}

function map(r: Raw): BaseDomain {
    // `tls` is NOT NULL with a column default in the schema; the cast narrows the
    // column text to the union without a runtime check (the write path validates it).
    return {
        domain: r.domain,
        tls: r.tls as BaseDomainTls,
        realmId: r.realm_id,
        createdAt: r.created_at,
    }
}

/** All registered base domains, oldest first (the whole pool, across realms). */
export function list(): BaseDomain[] {
    return allRows<Raw>('SELECT * FROM base_domain ORDER BY created_at').map(map)
}

/** Base domains served by one realm's wildcard, oldest first (multiple_realms.md §10.4). */
export function listByRealm(realmId: string): BaseDomain[] {
    return allRows<Raw>(
        'SELECT * FROM base_domain WHERE realm_id = ? ORDER BY created_at',
        realmId,
    ).map(map)
}

/**
 * Register a base domain with a subdomain TLS policy (§10/§0), bound to a realm (the
 * instance whose wildcard serves it, §10.4). `createdAt` defaults to now. Throws on
 * conflict (the domain is the primary key, so registration is idempotent only if
 * callers dedupe first).
 */
export function add(
    domain: string,
    tls: BaseDomainTls,
    realmId: string,
    createdAt: string = new Date().toISOString(),
): void {
    prep(
        'INSERT INTO base_domain (domain, tls, realm_id, created_at) VALUES (?, ?, ?, ?)',
    ).run(domain, tls, realmId, createdAt)
}

/** Update a base domain's subdomain TLS policy (§0/Phase D). No-op on an unknown domain. */
export function setTls(domain: string, tls: BaseDomainTls): void {
    prep('UPDATE base_domain SET tls = ? WHERE domain = ?').run(tls, domain)
}

/** Remove a base domain. No-op if it was never registered. */
export function remove(domain: string): void {
    prep('DELETE FROM base_domain WHERE domain = ?').run(domain)
}

// ── realm scoping (multiple_realms.md §B.2) ───────────────────────────────────

/** Count base domains bound to a realm — part of the realm-removal guard (§9). */
export function countByRealm(realmId: string): number {
    return (
        getRow<{ n: number }>('SELECT COUNT(*) AS n FROM base_domain WHERE realm_id = ?', realmId)
            ?.n ?? 0
    )
}
