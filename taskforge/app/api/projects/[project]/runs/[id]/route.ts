// B1 — one run's record + its persisted event frames (terminal replay).

import { guard, json, error, errorFrom } from '@/server/web/http'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import * as runRepo from '@/server/data/repositories/run-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string; id: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const id = Number(params.id)
        if (!Number.isInteger(id) || id <= 0) return error('invalid run id', 400)
        const run = runRepo.get(params.project, id)
        if (!run) return error('run not found', 404)
        const replay = runRepo.events(id)
        const events = replay.events.map((e) => {
            try {
                return JSON.parse(e.payload)
            } catch {
                return { type: e.type }
            }
        })
        return json({ run, events, eventsTruncated: replay.truncated })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
