import { guard, json } from '@/server/http'
import { engine } from '@/server/execution-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { repo: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(engine.stopAfterCurrent(params.repo))
}
