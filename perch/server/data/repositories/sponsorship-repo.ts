// Sponsorship repository — all SQL for the `sponsorship` table (§8, §12).
// Fed by the Sponsors webhook and the GraphQL reconcile job; linked to a user by
// login (`sponsor_login == app_user.login`). The effective-plan resolution
// (`tier_cents → plan_tier → Plan`) lives in `services/plan.ts`, not here.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Sponsorship, SponsorshipStatus } from '@/server/domain/types'

interface Raw {
    sponsor_login: string
    tier_cents: number
    status: string
    effective_at: string
    updated_at: string
}

function map(r: Raw): Sponsorship {
    return {
        sponsorLogin: r.sponsor_login,
        tierCents: r.tier_cents,
        status: r.status as SponsorshipStatus,
        effectiveAt: r.effective_at,
        updatedAt: r.updated_at,
    }
}

/**
 * Insert or update a sponsorship by `sponsor_login` (primary key). Both the
 * webhook and the reconcile job upsert, so the latest event wins.
 */
export function upsert(s: Sponsorship): void {
    prep(
        `INSERT INTO sponsorship (sponsor_login, tier_cents, status, effective_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(sponsor_login) DO UPDATE SET
            tier_cents   = excluded.tier_cents,
            status       = excluded.status,
            effective_at = excluded.effective_at,
            updated_at   = excluded.updated_at`,
    ).run(s.sponsorLogin, s.tierCents, s.status, s.effectiveAt, s.updatedAt)
}

export function get(sponsorLogin: string): Sponsorship | undefined {
    const r = getRow<Raw>('SELECT * FROM sponsorship WHERE sponsor_login = ?', sponsorLogin)
    return r ? map(r) : undefined
}

/** All currently-active sponsorships (drives the sponsor wall + plan grants). */
export function listActive(): Sponsorship[] {
    return allRows<Raw>(`SELECT * FROM sponsorship WHERE status = 'active' ORDER BY tier_cents DESC`).map(map)
}
