import { guard, json, error } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { fetchRemote, pull, discardAll, status, GitError } from '@/server/infrastructure/git'
import { UnsafePathError } from '@/server/infrastructure/fs-workspace'
import type { GitOp } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPS: Record<GitOp, (project: string) => Promise<void>> = {
    fetch: fetchRemote,
    pull,
    discard: discardAll,
}

export async function POST(req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    // fetch/pull/discard all touch the working tree or refs — never while a run holds the lock.
    if (engine.isLocked(params.project)) return error('run in progress', 409)

    const body = (await req.json().catch(() => ({}))) as { op?: string }
    const op = body.op as GitOp | undefined
    if (!op || !(op in OPS)) return error('unknown git op', 400)

    try {
        await OPS[op](params.project)
        return json(await status(params.project))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
}
