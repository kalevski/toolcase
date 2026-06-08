import { guard, json, error } from '@/server/http'
import { engine } from '@/server/execution-manager'
import { generateTasks } from '@/server/generate'
import { getTasks } from '@/server/repos'
import { repoExists, UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request, { params }: { params: { repo: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    try {
        if (!(await repoExists(params.repo))) return error('repo not found', 404)
        // don't mutate a live queue (§7.1)
        if (engine.isLocked(params.repo)) return error('run in progress', 409)

        const body = (await req.json().catch(() => ({}))) as { prompt?: string }
        if (!body.prompt || !body.prompt.trim()) return error('prompt required', 400)

        const result = await generateTasks(params.repo, body.prompt.trim())
        const tasks = await getTasks(params.repo)
        return json({ created: result.created, timedOut: result.timedOut, tasks })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
