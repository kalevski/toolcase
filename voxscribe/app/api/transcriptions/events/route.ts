// GET — SSE `job.updated` stream. Live events AND ring-buffer replay are
// filtered to the actor's own jobs unless admin (spec §4.2, §8).

import { guard } from '@/server/web/http'
import { sseResponse } from '@/server/web/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const isAdmin = auth.role === 'admin'
    const sub = auth.session.sub
    return sseResponse((event) => isAdmin || event.ownerId === sub)
}
