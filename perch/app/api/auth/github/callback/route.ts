import { NextResponse, type NextRequest } from 'next/server'
import {
    GH_TOKEN_COOKIE,
    SESSION_COOKIE,
    STATE_COOKIE,
    checkAllowlist,
    clearedCookieOptions,
    exchangeCodeForToken,
    fetchGithubProfile,
    ghTokenCookieOptions,
    makeSessionToken,
    resolveOnLogin,
    sessionCookieOptions,
    verifyStateToken,
} from '@/server/services/auth'
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
        // It is used here to read the profile, and then stashed in its own
        // `httpOnly` cookie so the create-site wizard can list the user's repos
        // and branches (§9 step 1) — see GH_TOKEN_COOKIE in services/auth.ts.
        const token = await exchangeCodeForToken(code)
        const profile = await fetchGithubProfile(token)

        if (!(await checkAllowlist(profile, token))) {
            return loginError('not_allowed')
        }

        const user = resolveOnLogin(profile)
        const session = makeSessionToken(profile, user.role)

        const res = NextResponse.redirect(new URL('/', base))
        res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions())
        res.cookies.set(GH_TOKEN_COOKIE, token, ghTokenCookieOptions())
        res.cookies.set(STATE_COOKIE, '', clearedCookieOptions())
        return res
    } catch {
        return loginError('oauth')
    }
}
