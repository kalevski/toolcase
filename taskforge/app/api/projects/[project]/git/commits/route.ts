import { guard, json, error } from '@/server/web/http'
import { unpushedCommits, recentCommits } from '@/server/infrastructure/git'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const [unpushed, recent] = await Promise.all([
            unpushedCommits(params.project),
            recentCommits(params.project, 15),
        ])
        return json({ unpushed, recent })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('git log failed', 500)
    }
}
