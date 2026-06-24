import { guard, json, error, audit } from '@/server/web/http'
import { engine, DirtyTreeError, LockHeldError } from '@/server/services/execution-manager'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { effectiveSettings } from '@/server/services/settings'
import { config } from '@/server/config'
import type { RunOptions } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const body = (await req.json().catch(() => ({}))) as Partial<RunOptions>

        const model = body.model || effectiveSettings(params.project).defaultModel
        if (!config.modelCatalog.includes(model)) {
            return error(`model not in catalog: ${model}`, 400)
        }

        const idList = (v: unknown) =>
            Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string' && t.length > 0) : undefined
        const resetTasks = idList(body.resetTasks)
        const onlyTasks = idList(body.onlyTasks)

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
            resetTasks: resetTasks?.length ? resetTasks : undefined,
            onlyTasks: onlyTasks?.length ? onlyTasks : undefined,
            dryRun: body.dryRun,
            pushAfter: body.pushAfter,
            branchPerRun: body.branchPerRun,
            review: body.review,
            openPr: body.openPr,
            startedBy: `user:${auth.session.login}`,
        }

        const snapshot = await engine.start(params.project, opts)
        audit(auth, 'run.start', params.project, `model=${model}${opts.dryRun ? ' dry' : ''}`)
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
