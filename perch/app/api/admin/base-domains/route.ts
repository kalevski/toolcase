// GET    /api/admin/base-domains — list the owner-managed subdomain pool (§10).
// POST   /api/admin/base-domains — register a base domain ({ domain, tier? }); tier
//        is one of free|paid|staff (the audience group, §10), defaulting to free.
// DELETE /api/admin/base-domains — remove a base domain (?domain= or { domain }).
//
// All guarded by `authorize('owner')` — a non-owner session is rejected 401/403 and
// never reaches the service. Validation, uniqueness, and the audit entry live in
// `services/admin.ts` (§13, §16).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.listBaseDomains())
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { domain?: unknown; tier?: unknown }
    try {
        body = (await req.json()) as { domain?: unknown; tier?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = admin.addBaseDomain(actor, body.domain, body.tier)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    // Accept the domain from the query string (a DELETE body is awkward for clients),
    // falling back to a JSON body if present.
    let domain: unknown = new URL(req.url).searchParams.get('domain') ?? undefined
    if (domain === undefined) {
        try {
            domain = ((await req.json()) as { domain?: unknown }).domain
        } catch {
            /* no body — handled as a missing domain below */
        }
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        admin.removeBaseDomain(actor, domain)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
