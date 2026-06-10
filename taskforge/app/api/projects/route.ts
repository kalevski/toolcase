import { guard, json, error, audit } from '@/server/web/http'
import { getProjectSummaries } from '@/server/services/projects'
import { createProject, ProjectExistsError } from '@/server/services/provision'
import { UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { GitError } from '@/server/infrastructure/git'

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
        audit(auth, 'project.create', name, gitUrl)
        return json({ name }, 201)
    } catch (e) {
        if (e instanceof ProjectExistsError) return error('project already exists', 409)
        if (e instanceof UnsafePathError) return error('invalid project name', 400)
        if (e instanceof GitError) {
            const needsAuth =
                /could not read Username|Authentication failed|terminal prompts disabled|repository not found|Permission denied|Host key verification/i.test(
                    `${e.stderr} ${e.message}`,
                )
            const hint = needsAuth
                ? ' — private repo, wrong URL, or SSH without a key. For private HTTPS repos set GIT_REMOTE_TOKEN (a GitHub PAT with `repo` scope) and restart.'
                : ''
            return error(`clone failed: ${e.message}${hint}`, 422)
        }
        throw e
    }
}
