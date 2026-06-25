// Pure decode/verify helpers behind the Sponsors webhook + scheduled GraphQL
// reconcile (§8, §16). No `server-only`, no DB, no policy — just HMAC signature
// verification and the payload → `Sponsorship` mappings — so the route and the
// reconcile service stay thin and these rules are unit-testable in isolation.
// `node:crypto` is pure computation (HMAC) and safe under vitest.
//
// See notes/static-hosting-app-design.md §8, §16.

import crypto from 'node:crypto'
import type { Sponsorship, SponsorshipStatus } from './types'

// ── webhook signature (§16) ──────────────────────────────────────────────────

/**
 * Constant-time check of a GitHub `X-Hub-Signature-256` header against an HMAC of
 * the *raw* request body keyed by the shared secret. Returns false for a missing
 * or malformed header and for any mismatch — the caller rejects with 401. The
 * length pre-check guards `timingSafeEqual` (which throws on unequal lengths);
 * the digest length is fixed and public, so it leaks nothing sensitive.
 */
export function verifyHubSignature(
    secret: string,
    rawBody: string,
    signatureHeader: string | null | undefined,
): boolean {
    if (!signatureHeader) return false
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const got = Buffer.from(signatureHeader)
    const want = Buffer.from(expected)
    if (got.length !== want.length) return false
    return crypto.timingSafeEqual(got, want)
}

// ── webhook payload → Sponsorship (§8) ───────────────────────────────────────

/** A sponsorship-event payload decoded to the fields we persist. */
export interface ParsedSponsorshipEvent {
    sponsorLogin: string
    tierCents: number
    status: SponsorshipStatus
    /** ISO timestamp carried by the payload, or null when the caller should
     *  substitute the receive time. */
    effectiveAt: string | null
}

/**
 * Map the four handled webhook actions to a stored status. Other actions
 * (`edited`, `pending_tier_change`, …) are deliberately ignored — the GraphQL
 * reconcile is the source of truth and will pick up anything missed here.
 */
const ACTION_STATUS: Record<string, SponsorshipStatus> = {
    created: 'active',
    tier_changed: 'active',
    cancelled: 'cancelled',
    pending_cancellation: 'pending_cancel',
}

/**
 * Decode a GitHub `sponsorship` webhook body into the fields we upsert, or null
 * when the action is unhandled or the payload is malformed (no sponsor login /
 * no tier price). For `tier_changed` GitHub rewrites `sponsorship.tier` to the
 * new tier, so reading it captures the post-change amount.
 */
export function parseSponsorshipEvent(payload: unknown): ParsedSponsorshipEvent | null {
    if (!payload || typeof payload !== 'object') return null
    const p = payload as any
    const status = ACTION_STATUS[p.action]
    if (!status) return null
    const sponsorLogin = p.sponsorship?.sponsor?.login
    if (typeof sponsorLogin !== 'string' || sponsorLogin === '') return null
    const tierCents = p.sponsorship?.tier?.monthly_price_in_cents
    if (typeof tierCents !== 'number' || !Number.isFinite(tierCents)) return null
    // `effective_date` accompanies the pending_* actions; otherwise fall back to
    // the sponsorship's `created_at`. null lets the caller stamp the receive time.
    const effectiveAt =
        typeof p.effective_date === 'string'
            ? p.effective_date
            : typeof p.sponsorship?.created_at === 'string'
              ? p.sponsorship.created_at
              : null
    return { sponsorLogin, tierCents, status, effectiveAt }
}

// ── GraphQL reconcile nodes → Sponsorship (§8) ───────────────────────────────

/** One node from the `sponsorshipsAsMaintainer` GraphQL connection, trimmed. */
export interface GraphqlSponsorshipNode {
    sponsorEntity?: { login?: string } | null
    tier?: { monthlyPriceInCents?: number } | null
    isActive?: boolean
    createdAt?: string
}

/**
 * Map reconcile nodes to authoritative `Sponsorship` rows. The connection is the
 * source of truth (§8): each node's `isActive` decides active vs cancelled,
 * overriding any stale webhook row on upsert. Nodes without a sponsor login are
 * skipped; a missing tier price counts as 0 cents (→ free). `now` stamps
 * `updatedAt` and backstops a missing `createdAt`.
 */
export function reconcileToSponsorships(nodes: GraphqlSponsorshipNode[], now: string): Sponsorship[] {
    const out: Sponsorship[] = []
    for (const n of nodes) {
        const sponsorLogin = n.sponsorEntity?.login
        if (typeof sponsorLogin !== 'string' || sponsorLogin === '') continue
        out.push({
            sponsorLogin,
            tierCents: typeof n.tier?.monthlyPriceInCents === 'number' ? n.tier.monthlyPriceInCents : 0,
            status: n.isActive ? 'active' : 'cancelled',
            effectiveAt: typeof n.createdAt === 'string' ? n.createdAt : now,
            updatedAt: now,
        })
    }
    return out
}
