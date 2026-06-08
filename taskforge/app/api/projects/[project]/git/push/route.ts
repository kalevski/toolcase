import { guard, json, error } from '@/server/http'
import { engine } from '@/server/execution-manager'
import { push, status, GitError } from '@/server/git'
import { canPush } from '@/server/config'
import { UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (!canPush()) return error('no push credential configured', 412)
    if (engine.isLocked(params.project)) return error('run in progress', 409)

    try {
        await push(params.project)
        return json(await status(params.project))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
}
