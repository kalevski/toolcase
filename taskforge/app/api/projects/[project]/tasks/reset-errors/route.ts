import { guard, json, error } from '@/server/http'
import { engine } from '@/server/execution-manager'
import { resetErrorTasksToPending } from '@/server/projects'
import { projectExists, UnsafePathError } from '@/server/fs-workspace'
import { slog } from '@/server/server-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        // Don't rewrite the ledger out from under a live run (§7.1).
        if (engine.isLocked(params.project)) return error('run in progress', 409)

        slog('info', 'api', `POST reset-errors`, { project: params.project, by: auth.session.login })
        const { moved, tasks } = await resetErrorTasksToPending(params.project)
        return json({ moved, tasks })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        slog('error', 'api', `reset-errors failed`, {
            project: params.project,
            error: (e as Error)?.message ?? String(e),
        })
        throw e
    }
}
