// GET /api/github/repos — list the signed-in user's repositories for the
// create-site wizard (§9 step 1, §13). Guarded by `authorize('standard')`; calls
// the GitHub REST helper with the caller's access token.

import { NextResponse } from 'next/server'
import { authorize, getGithubToken } from '@/server/services/auth'
import { GithubError, listRepos } from '@/server/infrastructure/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const token = await getGithubToken()
    if (!token) return NextResponse.json({ error: 'github_token_missing' }, { status: 401 })

    try {
        return NextResponse.json(await listRepos(token))
    } catch (err) {
        const status = err instanceof GithubError ? (err.status ?? 502) : 502
        return NextResponse.json({ error: 'github_error' }, { status })
    }
}
