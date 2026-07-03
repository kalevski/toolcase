import { NextResponse, type NextRequest } from 'next/server'
import {
    GH_TOKEN_COOKIE,
    SESSION_COOKIE,
    STATE_COOKIE,
    checkAllowlist,
    clearedCookieOptions,
    exchangeCodeForToken,
    fetchGithubProfile,
    makeSessionToken,
    resolveOnLogin,
    saveGithubToken,
    sessionCookieOptions,
    verifyStateToken,
} from '@/server/services/auth'
import { refreshGithubCredentials } from '@/server/services/sites'
import { config } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const cookieState = req.cookies.get(STATE_COOKIE)?.value

    const base = config.publicOrigin || req.url

    const loginError = (reason: string) => {
        const res = NextResponse.redirect(new URL(`/login?error=${reason}`, base))
        res.cookies.set(STATE_COOKIE, '', clearedCookieOptions())
        return res
    }

    // single-use, signed state check (CSRF / replay)
    if (!code || !state || !cookieState || state !== cookieState || !verifyStateToken(state)) {
        return loginError('state')
    }

    try {
        // The GitHub access token is never written into the session payload (§7).
        // It identifies the user here, then is stored encrypted (`user_github_token`)
        // so the wizard's repo/branch listing works for the whole session and private
        // sites keep a valid clone credential — see `saveGithubToken` in services/auth.ts.
        const token = await exchangeCodeForToken(code)
        const profile = await fetchGithubProfile(token)

        if (!(await checkAllowlist(profile, token))) {
            return loginError('not_allowed')
        }

        const user = resolveOnLogin(profile)
        const session = makeSessionToken(profile, user.role)
        saveGithubToken(profile.githubId, token)
        // A fresh token may replace a revoked/rotated one — re-push it to the
        // git-credentials store of every realm the user's private sites deploy to,
        // so interval pulls recover without a redeploy. Fire-and-forget.
        refreshGithubCredentials(profile.githubId)

        const res = NextResponse.redirect(new URL('/', base))
        res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions())
        // Clear the legacy short-lived token cookie (the token lives in the DB now).
        res.cookies.set(GH_TOKEN_COOKIE, '', clearedCookieOptions())
        res.cookies.set(STATE_COOKIE, '', clearedCookieOptions())
        return res
    } catch {
        return loginError('oauth')
    }
}
