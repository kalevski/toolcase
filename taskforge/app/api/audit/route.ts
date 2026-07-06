// D3 — audit log (admin): filterable list of who-did-what.

import { guard, json } from '@/server/web/http'
import * as auditRepo from '@/server/data/repositories/audit-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const sp = new URL(req.url).searchParams
    return json({
        entries: auditRepo.list({
            project: sp.get('project') ?? undefined,
            login: sp.get('login') ?? undefined,
            action: sp.get('action') ?? undefined,
            beforeId: Number(sp.get('beforeId')) || undefined,
            limit: Number(sp.get('limit')) || 100,
        }),
        actions: auditRepo.actions(),
        total: auditRepo.count(),
    })
}
