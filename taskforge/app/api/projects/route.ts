import { guard, json, error } from '@/server/http'
import { getProjectSummaries } from '@/server/projects'
import { createProject, ProjectExistsError } from '@/server/provision'
import { UnsafePathError } from '@/server/fs-workspace'
import { GitError } from '@/server/git'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Cloning a large repo can take a while.
export const maxDuration = 300

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(await getProjectSummaries())
}

export async function POST(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    const body = (await req.json().catch(() => ({}))) as {
        name?: string
        gitUrl?: string
        branch?: string
    }
    const name = (body.name ?? '').trim()
    const gitUrl = (body.gitUrl ?? '').trim()
    const branch = (body.branch ?? '').trim() || undefined
    if (!name) return error('name required', 400)
    if (!gitUrl) return error('gitUrl required', 400)

    try {
        await createProject({ name, gitUrl, branch })
        return json({ name }, 201)
    } catch (e) {
        if (e instanceof ProjectExistsError) return error('project already exists', 409)
        if (e instanceof UnsafePathError) return error('invalid project name', 400)
        if (e instanceof GitError) return error(`clone failed: ${e.message}`, 422)
        throw e
    }
}
