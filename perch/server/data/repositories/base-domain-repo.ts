// Base-domain repository — all SQL for the `base_domain` table (§10, §12).
// The owner-managed subdomain pool: every registered base domain backs
// `<label>.<domain>` subdomain sites. Raw-SQL list/add/remove only; label
// validation and reserved-word blocking live in a service.

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { BaseDomain } from '@/server/domain/types'

interface Raw {
    domain: string
    created_at: string
}

function map(r: Raw): BaseDomain {
    return { domain: r.domain, createdAt: r.created_at }
}

/** All registered base domains, oldest first. */
export function list(): BaseDomain[] {
    return allRows<Raw>('SELECT * FROM base_domain ORDER BY created_at').map(map)
}

/**
 * Register a base domain. `createdAt` defaults to now. Throws on conflict
 * (the domain is the primary key, so registration is idempotent only if callers
 * dedupe first).
 */
export function add(domain: string, createdAt: string = new Date().toISOString()): void {
    prep('INSERT INTO base_domain (domain, created_at) VALUES (?, ?)').run(domain, createdAt)
}

/** Remove a base domain. No-op if it was never registered. */
export function remove(domain: string): void {
    prep('DELETE FROM base_domain WHERE domain = ?').run(domain)
}
