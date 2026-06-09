import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { generateProjectClaudeMd } from '@/server/services/provision'
import { engine } from '@/server/services/execution-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The generation pass spawns the agent and can take a while.
export const maxDuration = 300

export async function POST(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project)) return error('run in progress', 409)
        await generateProjectClaudeMd(params.project)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
