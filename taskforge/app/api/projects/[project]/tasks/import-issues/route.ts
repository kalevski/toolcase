// E2 — import selected GitHub issues as numbered task files
// (`**Source:** github#<n>` facet; completion comments/closes the issue).

import { guard, json, error, audit } from '@/server/web/http'
import { projectExists, createTask, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { parseGithubRepo, listOpenIssues, GithubError } from '@/server/infrastructure/github'
import { readProjectMeta } from '@/server/services/provision'
import { engine } from '@/server/services/execution-manager'
import { getTasks } from '@/server/services/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project)) return error('a run is in progress', 409)

        const body = (await req.json().catch(() => ({}))) as { numbers?: number[] }
        const numbers = Array.isArray(body.numbers)
            ? body.numbers.filter((n): n is number => Number.isInteger(n) && n > 0)
            : []
        if (!numbers.length) return error('numbers required', 400)
        if (numbers.length > 50) return error('too many issues (max 50)', 400)

        const meta = await readProjectMeta(params.project)
        const gh = parseGithubRepo(meta.gitUrl)
        if (!gh) return error('project origin is not a GitHub repository', 400)

        const issues = await listOpenIssues(gh.owner, gh.repo, 100)
        const byNumber = new Map(issues.map((i) => [i.number, i]))

        const created: string[] = []
        const missing: number[] = []
        for (const n of numbers) {
            const issue = byNumber.get(n)
            if (!issue) {
                missing.push(n)
                continue
            }
            const bodyMd = [
                '## Problem',
                '',
                issue.body.trim() || issue.title,
                '',
                `_Imported from ${issue.url}_`,
            ].join('\n')
            const id = await createTask(params.project, {
                title: issue.title,
                body: bodyMd,
                source: `github#${issue.number}`,
                project: issue.labels[0]?.toLowerCase(),
            })
            created.push(id)
        }

        audit(auth, 'task.import-issues', params.project, `${created.length} issue(s)`)
        return json({ created, missing, tasks: await getTasks(params.project) }, 201)
    } catch (e) {
        if (e instanceof GithubError) return error(e.message, 502)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
