import { guard, json, error } from '@/server/http'
import { engine } from '@/server/execution-manager'
import { createOrSwitchBranch, status, GitError } from '@/server/git'
import { UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { repo: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (engine.isLocked(params.repo)) return error('run in progress', 409)

    const body = (await req.json().catch(() => ({}))) as { name?: string }
    if (!body.name) return error('branch name required', 400)

    try {
        await createOrSwitchBranch(params.repo, body.name)
        return json(await status(params.repo))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
}
