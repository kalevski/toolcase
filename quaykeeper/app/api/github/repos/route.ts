// GET /api/github/repos — list the signed-in user's repositories for the
// create-site wizard (§9 step 1, §13). Guarded by `authorize('standard')`; calls
// the GitHub REST helper with the caller's stored access token. Private repos are
// filtered out server-side unless the caller's plan grants `privateRepos`, so the
// wizard only offers sources the create gate would accept.

import { NextResponse } from 'next/server'
import { authorize, getGithubTokenFor } from '@/server/services/auth'
import { resolveLimits } from '@/server/services/plan'
import { GithubError, listRepos } from '@/server/infrastructure/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const token = getGithubTokenFor(authz.session.sub)
    if (!token) return NextResponse.json({ error: 'github_token_missing' }, { status: 401 })

    try {
        const repos = await listRepos(token)
        const allowPrivate = resolveLimits(authz.session.login).privateRepos
        return NextResponse.json(allowPrivate ? repos : repos.filter((r) => !r.private))
    } catch (err) {
        const status = err instanceof GithubError ? (err.status ?? 502) : 502
        return NextResponse.json({ error: 'github_error' }, { status })
    }
}
