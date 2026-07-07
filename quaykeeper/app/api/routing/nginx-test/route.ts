// POST /api/routing/nginx-test — managed-mode dry run (Phase E). Previews the
// per-resource pass/fail set nginxpilot's `nginx -t` gate would apply, WITHOUT
// committing it, so a maintainer can sanity-check a batch before trusting the live
// apply. Guarded by `authorize('standard', 'routing')`.
//
// Response shape (always 200 unless auth/daemon fails):
//   { managed: false }                                  — daemon not in managed mode (501)
//   { managed: true, resources: NginxResource[], error? } — the dry-run result

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        const result = await routing.nginxTest(client)
        if (!result) return NextResponse.json({ managed: false })
        return NextResponse.json({ managed: true, resources: result.resources, error: result.error })
    } catch (err) {
        const { status, code } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
