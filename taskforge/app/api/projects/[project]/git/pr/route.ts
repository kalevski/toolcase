// B7 — open a GitHub PR for the current branch (manual button on the Git page).
// Pushes first so the head exists on the remote.

import { guard, json, error, audit, errorFrom } from '@/server/web/http'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import { parseGithubRepo, createPull, defaultBranch } from '@/server/infrastructure/github'
import { readProjectMeta } from '@/server/services/provision'
import { engine } from '@/server/services/execution-manager'
import * as git from '@/server/infrastructure/git'
import { canPush } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project)) return error('a run is in progress', 409)
        if (!canPush()) return error('no push credential configured (GIT_REMOTE_TOKEN)', 400)

        const meta = await readProjectMeta(params.project)
        const gh = parseGithubRepo(meta.gitUrl)
        if (!gh) return error('project origin is not a GitHub repository', 400)

        const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string }
        const status = await git.status(params.project)
        if (status.dirty) return error('working tree is dirty — commit or discard first', 412)

        const base = meta.branch || (await defaultBranch(gh.owner, gh.repo))
        if (status.branch === base) {
            return error(`current branch is the base branch (${base}) — create a branch first`, 400)
        }

        await git.push(params.project)
        const commits = await git.unpushedCommits(params.project).catch(() => [])
        const recent = await git.recentCommits(params.project, 10)
        const listed = (commits.length ? commits : recent).map((c) => `- ${c.subject}`).join('\n')
        const url = await createPull(gh.owner, gh.repo, {
            title: body.title?.trim() || `taskforge: ${status.branch}`,
            head: status.branch,
            base,
            body: body.body?.trim() || `Changes from TaskForge branch \`${status.branch}\`.\n\n${listed}`,
        })
        audit(auth, 'git.pr', params.project, url)
        return json({ url })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
