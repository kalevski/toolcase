// GET    /api/admin/base-domains — list the owner-managed subdomain pool (§10).
// POST   /api/admin/base-domains — register a base domain ({ domain, tls?, http2?, hsts? });
//        tls is off|auto (the subdomain wildcard TLS policy, §0/Phase D), defaulting to
//        auto; http2 is the wildcard-wide HTTP/2 policy, defaulting to true; hsts is the
//        wildcard-wide Strict-Transport-Security policy, defaulting to false (it is sticky
//        in browsers, so it is opt-in only).
// PATCH  /api/admin/base-domains — update ONE of a base domain's wildcard policies:
//        { domain, tls } | { domain, http2 } | { domain, hsts }.
// DELETE /api/admin/base-domains — remove a base domain (?domain= or { domain }).
//
// All guarded by `authorize('owner')` — a non-owner session is rejected 401/403 and
// never reaches the service. Validation, uniqueness, and the audit entry live in
// `services/admin.ts` (§13, §16).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    // Base domains are per-realm (multiple_realms.md §E.2) — show the owner's active realm pool.
    try {
        const active = await realms.resolveActiveRealm(authz.session.sub, authz.role)
        return NextResponse.json(admin.listBaseDomains(active.id))
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { domain?: unknown; tls?: unknown; http2?: unknown; hsts?: unknown }
    try {
        body = (await req.json()) as { domain?: unknown; tls?: unknown; http2?: unknown; hsts?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const active = await realms.resolveActiveRealm(authz.session.sub, authz.role)
        const created = admin.addBaseDomain(actor, body.domain, body.tls, active.id, body.http2, body.hsts)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function PATCH(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { domain?: unknown; tls?: unknown; http2?: unknown; hsts?: unknown }
    try {
        body = (await req.json()) as { domain?: unknown; tls?: unknown; http2?: unknown; hsts?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        // One policy per request — each is routed to its own service call so every
        // change lands as a distinct audit entry rather than a merged base-domain patch.
        const updated =
            body.http2 !== undefined
                ? admin.setBaseDomainHttp2(actor, body.domain, body.http2)
                : body.hsts !== undefined
                  ? admin.setBaseDomainHsts(actor, body.domain, body.hsts)
                  : admin.setBaseDomainTls(actor, body.domain, body.tls)
        return NextResponse.json(updated)
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
