import { NextResponse, type NextRequest } from 'next/server'
import {
    SESSION_COOKIE,
    STATE_COOKIE,
    checkAllowlist,
    clearedCookieOptions,
    exchangeCodeForToken,
    fetchGithubProfile,
    makeSessionToken,
    sessionCookieOptions,
    verifyStateToken,
} from '@/server/services/auth'
import { config } from '@/server/config'
import { resolveOnLogin } from '@/server/services/roles'

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
        const token = await exchangeCodeForToken(code)
        const profile = await fetchGithubProfile(token)

        if (!(await checkAllowlist(profile, token))) {
            return loginError('not_allowed')
        }

        // resolveOnLogin persists/updates the user's authoritative role in roles.json;
        // the role is intentionally NOT embedded in the session token (IMP-4).
        await resolveOnLogin(profile)
        const session = makeSessionToken(profile)

        const res = NextResponse.redirect(new URL('/', base))
        res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions())
        res.cookies.set(STATE_COOKIE, '', clearedCookieOptions())
        return res
    } catch {
        return loginError('oauth')
    }
}
