import { guard, json, audit } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    audit(auth, 'run.stop', params.project)
    return json(engine.stopAfterCurrent(params.project))
}
