// POST /api/webhooks/github-sponsors — receive GitHub Sponsors `sponsorship`
// events (§8). Verifies the `X-Hub-Signature-256` HMAC (constant-time) against
// PERCH_SPONSORS_WEBHOOK_SECRET and rejects a bad/absent signature with 401 — a
// forged or unsigned event must never grant a plan (§16). Handled actions
// (`created` / `tier_changed` / `cancelled` / `pending_cancellation`) upsert the
// `sponsorship` row; other actions are acknowledged and ignored (the scheduled
// GraphQL reconcile is the source of truth).

import { NextResponse } from 'next/server'
import { config } from '@/server/config'
import { parseSponsorshipEvent, verifyHubSignature } from '@/server/domain/sponsorship-events'
import { slog } from '@/server/infrastructure/server-log'
import * as sponsorshipRepo from '@/server/data/repositories/sponsorship-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    // Read the RAW body — the HMAC is computed over the exact bytes GitHub sent,
    // so re-serializing parsed JSON would break verification.
    const raw = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (!verifyHubSignature(config.sponsorsWebhookSecret, raw, signature)) {
        slog('warn', 'sponsors-webhook', 'rejected: bad signature')
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }

    let payload: unknown
    try {
        payload = JSON.parse(raw)
    } catch {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }

    const parsed = parseSponsorshipEvent(payload)
    if (!parsed) {
        // Unhandled action or malformed body — ack so GitHub doesn't retry; the
        // reconcile job will catch anything material.
        return NextResponse.json({ ok: true, ignored: true })
    }

    const now = new Date().toISOString()
    sponsorshipRepo.upsert({
        sponsorId: parsed.sponsorId,
        sponsorLogin: parsed.sponsorLogin,
        tierCents: parsed.tierCents,
        status: parsed.status,
        effectiveAt: parsed.effectiveAt ?? now,
        updatedAt: now,
    })
    slog('info', 'sponsors-webhook', 'sponsorship upserted', {
        sponsorId: parsed.sponsorId,
        login: parsed.sponsorLogin,
        status: parsed.status,
        tierCents: parsed.tierCents,
    })
    return NextResponse.json({ ok: true })
}
