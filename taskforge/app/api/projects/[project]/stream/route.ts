import { authorize } from '@/server/services/auth'
import { sseResponse } from '@/server/web/sse'
import { error } from '@/server/web/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { project: string } }) {
    const auth = await authorize('standard')
    if (!auth.ok) return error(auth.status === 401 ? 'unauthorized' : 'forbidden', auth.status)
    return sseResponse(params.project)
}
