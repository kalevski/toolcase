// Sponsorship repository — all SQL for the `sponsorship` table (§8, §12).
// Fed by the Sponsors webhook and the GraphQL reconcile job; linked to a user by
// the sponsor's IMMUTABLE numeric GitHub id (`sponsor_id == app_user.github_id`),
// NOT login — a reusable username must never inherit a stale sponsorship (S3).
// The effective-plan resolution (`tier_cents → plan_tier → Plan`) lives in
// `services/plan.ts`, not here.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Sponsorship, SponsorshipStatus } from '@/server/domain/types'

interface Raw {
    sponsor_id: number
    sponsor_login: string
    tier_cents: number
    status: string
    effective_at: string
    updated_at: string
}

function map(r: Raw): Sponsorship {
    return {
        sponsorId: r.sponsor_id,
        sponsorLogin: r.sponsor_login,
        tierCents: r.tier_cents,
        status: r.status as SponsorshipStatus,
        effectiveAt: r.effective_at,
        updatedAt: r.updated_at,
    }
}

/**
 * Insert or update a sponsorship by `sponsor_id` (primary key). Both the webhook
 * and the reconcile job upsert, so the latest event wins. `sponsor_login` is
 * refreshed too so the display name tracks any rename.
 */
export function upsert(s: Sponsorship): void {
    prep(
        `INSERT INTO sponsorship (sponsor_id, sponsor_login, tier_cents, status, effective_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(sponsor_id) DO UPDATE SET
            sponsor_login = excluded.sponsor_login,
            tier_cents    = excluded.tier_cents,
            status        = excluded.status,
            effective_at  = excluded.effective_at,
            updated_at    = excluded.updated_at`,
    ).run(s.sponsorId, s.sponsorLogin, s.tierCents, s.status, s.effectiveAt, s.updatedAt)
}

/** The sponsorship for a sponsor's GitHub id, if any (the plan-resolution lookup). */
export function getById(sponsorId: number): Sponsorship | undefined {
    const r = getRow<Raw>('SELECT * FROM sponsorship WHERE sponsor_id = ?', sponsorId)
    return r ? map(r) : undefined
}

/** Delete a sponsorship by sponsor id (reconcile prune of vanished sponsors, S3). */
export function removeById(sponsorId: number): void {
    prep('DELETE FROM sponsorship WHERE sponsor_id = ?').run(sponsorId)
}

/** Every sponsor id currently on file (drives the reconcile prune of vanished rows). */
export function allIds(): number[] {
    return allRows<{ sponsor_id: number }>('SELECT sponsor_id FROM sponsorship').map((r) => r.sponsor_id)
}

/** All currently-active sponsorships (drives the sponsor wall + plan grants). */
export function listActive(): Sponsorship[] {
    return allRows<Raw>(`SELECT * FROM sponsorship WHERE status = 'active' ORDER BY tier_cents DESC`).map(map)
}
