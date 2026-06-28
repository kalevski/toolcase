import { guardProject, json } from '@/server/web/http'
import { listProjectAudit } from '@/server/services/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Project audit log (devops+), cursor-paginated via ?before=<id>&limit=.
export async function GET(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const sp = new URL(req.url).searchParams
    const before = sp.get('before') ? Number(sp.get('before')) : undefined
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined
    return json(listProjectAudit(id, { before, limit }))
}
