import { guard, json, error } from '@/server/http'
import { engine, DirtyTreeError, LockHeldError } from '@/server/execution-manager'
import { repoExists, UnsafePathError } from '@/server/fs-workspace'
import { config } from '@/server/config'
import type { RunOptions } from '@/server/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { repo: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    try {
        if (!(await repoExists(params.repo))) return error('repo not found', 404)
        const body = (await req.json().catch(() => ({}))) as Partial<RunOptions>

        const model = body.model || config.defaultModel
        if (!config.modelCatalog.includes(model)) {
            return error(`model not in catalog: ${model}`, 400)
        }

        const opts: RunOptions = {
            model,
            warmSession: body.warmSession,
            commitAfter: body.commitAfter,
            commitMessageMode: body.commitMessageMode,
            commitModel: body.commitModel,
            filter: body.filter,
            resumeFrom: body.resumeFrom,
            severity: body.severity,
            project: body.project,
            reset: body.reset,
            dryRun: body.dryRun,
        }

        const snapshot = await engine.start(params.repo, opts)
        return json(snapshot)
    } catch (e) {
        if (e instanceof DirtyTreeError) {
            return json({ error: 'dirty tree', dirtyFiles: e.files }, 412)
        }
        if (e instanceof LockHeldError) return error('a run is already in progress', 409)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
