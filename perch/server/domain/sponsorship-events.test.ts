// Unit coverage for the pure pieces behind the Sponsors webhook + reconcile
// (§8, §16): constant-time signature verification, the webhook payload → upsert
// mapping, and the GraphQL reconcile mapping. No SQLite, no `server-only`, so the
// route/scheduler are just these functions wired to the repo + crypto.

import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import { parseSponsorshipEvent, reconcileToSponsorships, verifyHubSignature } from './sponsorship-events'

const SECRET = 'a-long-enough-webhook-secret'

/** Sign a raw body exactly as a GitHub Sponsors webhook would. */
function sign(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

describe('verifyHubSignature', () => {
    const body = JSON.stringify({ action: 'created' })

    it('accepts a correctly-signed body', () => {
        expect(verifyHubSignature(SECRET, body, sign(SECRET, body))).toBe(true)
    })

    it('rejects a wrong secret, a tampered body, and a missing header', () => {
        expect(verifyHubSignature(SECRET, body, sign('other-secret-value', body))).toBe(false)
        expect(verifyHubSignature(SECRET, body + ' ', sign(SECRET, body))).toBe(false)
        expect(verifyHubSignature(SECRET, body, null)).toBe(false)
        expect(verifyHubSignature(SECRET, body, undefined)).toBe(false)
    })

    it('rejects a malformed/short signature without throwing', () => {
        expect(verifyHubSignature(SECRET, body, 'sha256=deadbeef')).toBe(false)
        expect(verifyHubSignature(SECRET, body, 'garbage')).toBe(false)
    })
})

describe('parseSponsorshipEvent', () => {
    function event(action: string, cents: number, extra: Record<string, unknown> = {}) {
        return {
            action,
            sponsorship: {
                sponsor: { id: 4242, login: 'alice' },
                tier: { monthly_price_in_cents: cents },
                created_at: '2026-06-01T00:00:00Z',
            },
            ...extra,
        }
    }

    it('maps a tier_changed event to the new active tier (the §8 verify case)', () => {
        const parsed = parseSponsorshipEvent(event('tier_changed', 2500))
        expect(parsed).toEqual({
            sponsorId: 4242,
            sponsorLogin: 'alice',
            tierCents: 2500,
            status: 'active',
            effectiveAt: '2026-06-01T00:00:00Z',
        })
    })

    it('rejects a payload missing the sponsor id (S3 — id is the key)', () => {
        expect(
            parseSponsorshipEvent({
                action: 'created',
                sponsorship: { sponsor: { login: 'noid' }, tier: { monthly_price_in_cents: 500 } },
            }),
        ).toBeNull()
    })

    it('maps each handled action to the right status', () => {
        expect(parseSponsorshipEvent(event('created', 500))?.status).toBe('active')
        expect(parseSponsorshipEvent(event('cancelled', 500))?.status).toBe('cancelled')
        expect(parseSponsorshipEvent(event('pending_cancellation', 500))?.status).toBe('pending_cancel')
    })

    it('prefers effective_date when present (pending_* actions)', () => {
        const parsed = parseSponsorshipEvent(
            event('pending_cancellation', 500, { effective_date: '2026-07-01T00:00:00Z' }),
        )
        expect(parsed?.effectiveAt).toBe('2026-07-01T00:00:00Z')
    })

    it('falls back to null effectiveAt when the payload carries no timestamp', () => {
        const parsed = parseSponsorshipEvent({
            action: 'created',
            sponsorship: { sponsor: { id: 7, login: 'bob' }, tier: { monthly_price_in_cents: 100 } },
        })
        expect(parsed?.effectiveAt).toBeNull()
    })

    it('ignores unhandled actions and malformed payloads', () => {
        expect(parseSponsorshipEvent(event('edited', 500))).toBeNull()
        expect(parseSponsorshipEvent(event('pending_tier_change', 500))).toBeNull()
        expect(parseSponsorshipEvent(null)).toBeNull()
        expect(parseSponsorshipEvent({ action: 'created' })).toBeNull() // no sponsor/tier
        expect(parseSponsorshipEvent({ action: 'created', sponsorship: { sponsor: { login: 'x' } } })).toBeNull()
    })
})

describe('reconcileToSponsorships', () => {
    const NOW = '2026-06-25T12:00:00.000Z'

    it('maps active and cancelled nodes, skipping ones without a sponsor login', () => {
        const rows = reconcileToSponsorships(
            [
                {
                    sponsorEntity: { databaseId: 1, login: 'alice' },
                    tier: { monthlyPriceInCents: 2500 },
                    isActive: true,
                    createdAt: '2026-01-01T00:00:00Z',
                },
                { sponsorEntity: { databaseId: 2, login: 'bob' }, tier: { monthlyPriceInCents: 500 }, isActive: false },
                { sponsorEntity: null, tier: { monthlyPriceInCents: 500 }, isActive: true },
                // No databaseId → skipped (we key by immutable id, S3).
                { sponsorEntity: { login: 'noid' }, tier: { monthlyPriceInCents: 500 }, isActive: true },
            ],
            NOW,
        )
        expect(rows).toEqual([
            {
                sponsorId: 1,
                sponsorLogin: 'alice',
                tierCents: 2500,
                status: 'active',
                effectiveAt: '2026-01-01T00:00:00Z',
                updatedAt: NOW,
            },
            { sponsorId: 2, sponsorLogin: 'bob', tierCents: 500, status: 'cancelled', effectiveAt: NOW, updatedAt: NOW },
        ])
    })

    it('treats a missing tier price as 0 cents (→ free)', () => {
        const [row] = reconcileToSponsorships(
            [{ sponsorEntity: { databaseId: 9, login: 'carol' }, isActive: true }],
            NOW,
        )
        expect(row.tierCents).toBe(0)
    })
})
