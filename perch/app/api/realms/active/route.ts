// POST /api/realms/active — set the owner's active realm (multiple_realms.md §E.1).
// Owner-only (`authorize('owner')`): validates the realm exists, then writes the signed
// `perch_realm` cookie the switcher uses. Non-owners can't switch (§0.6) — they're pinned
// to their owner-assigned default realm, so this route refuses them at the role gate.
//
// No edge middleware: realm resolution is a Node service helper (it needs DB access +
// decryption), called by routes like `authorize()` — not an Edge concern.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authorize, REALM_COOKIE, realmCookieOptions, signRealmToken } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { realmId?: unknown }
    try {
        body = (await req.json()) as { realmId?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const realmId = typeof body.realmId === 'string' ? body.realmId : ''
    const realm = realmId ? realms.getRealm(realmId) : undefined
    if (!realm) return NextResponse.json({ error: 'realm_not_found' }, { status: 404 })
    ;(await cookies()).set(REALM_COOKIE, signRealmToken(realm.id), realmCookieOptions())
    return NextResponse.json(realm)
}
