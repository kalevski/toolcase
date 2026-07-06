// GET /api/github/repos/{owner}/{repo}/branches — list a repo's branches for the
// create-site wizard (§9 step 1, §13). Guarded by `authorize('standard')`; calls
// the GitHub REST helper with the caller's access token.

import { NextResponse } from 'next/server'
import { authorize, getGithubTokenFor } from '@/server/services/auth'
import { GithubError, listBranches } from '@/server/infrastructure/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const token = getGithubTokenFor(authz.session.sub)
    if (!token) return NextResponse.json({ error: 'github_token_missing' }, { status: 401 })

    const { owner, repo } = await ctx.params
    try {
        return NextResponse.json(await listBranches(token, owner, repo))
    } catch (err) {
        const status = err instanceof GithubError ? (err.status ?? 502) : 502
        return NextResponse.json({ error: 'github_error' }, { status })
    }
}
