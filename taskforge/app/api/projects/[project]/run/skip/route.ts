import { guard, json, error, audit } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (engine.state(params.project) !== 'RUNNING') return error('no task is currently running', 409)
    audit(auth, 'run.skip', params.project)
    return json(engine.skipCurrent(params.project))
}
