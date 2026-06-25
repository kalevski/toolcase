import { NextResponse, type NextRequest } from 'next/server'
import {
    SESSION_COOKIE,
    STATE_COOKIE,
    checkAllowlist,
    clearedCookieOptions,
    exchangeCodeForToken,
    fetchGithubProfile,
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
        // The GitHub access token lives only for this callback — used to read the
        // profile, then dropped. It is never written into the session (§7).
        const token = await exchangeCodeForToken(code)
        const profile = await fetchGithubProfile(token)

        if (!(await checkAllowlist(profile, token))) {
            return loginError('not_allowed')
        }

        const user = resolveOnLogin(profile)
        const session = makeSessionToken(profile, user.role)

        const res = NextResponse.redirect(new URL('/', base))
        res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions())
        res.cookies.set(STATE_COOKIE, '', clearedCookieOptions())
        return res
    } catch {
        return loginError('oauth')
    }
}
