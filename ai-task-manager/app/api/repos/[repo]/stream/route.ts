import { authorize } from '@/server/auth'
import { sseResponse } from '@/server/sse'
import { error } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { repo: string } }) {
    const auth = await authorize('standard')
    if (!auth.ok) return error(auth.status === 401 ? 'unauthorized' : 'forbidden', auth.status)
    return sseResponse(params.repo)
}
