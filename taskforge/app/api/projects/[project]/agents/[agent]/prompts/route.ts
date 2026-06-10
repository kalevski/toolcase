// C1 — full prompt history for one (project, agent).

import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import * as promptHistoryRepo from '@/server/data/repositories/prompt-history-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { project: string; agent: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const limit = Number(new URL(req.url).searchParams.get('limit')) || 20
        return json(promptHistoryRepo.history(params.project, params.agent, Math.min(limit, 100)))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
