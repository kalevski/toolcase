import { guard, json } from '@/server/web/http'
import { listGlobalAudit } from '@/server/services/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Global audit log (owner), cursor-paginated via ?before=<id>&limit=.
export async function GET(req: Request) {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const sp = new URL(req.url).searchParams
    const before = sp.get('before') ? Number(sp.get('before')) : undefined
    // Guard non-numeric ?limit= (e.g. `?limit=abc` → NaN → `LIMIT NaN` 500, wharf C1).
    const lim = Number(sp.get('limit'))
    const limit = Number.isFinite(lim) ? lim : undefined
    return json(listGlobalAudit({ before, limit }))
}
