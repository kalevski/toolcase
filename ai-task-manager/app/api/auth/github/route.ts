import { NextResponse } from 'next/server'
import { buildAuthorizeUrl, makeStateToken, STATE_COOKIE, stateCookieOptions } from '@/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const state = makeStateToken()
    const res = NextResponse.redirect(buildAuthorizeUrl(state))
    res.cookies.set(STATE_COOKIE, state, stateCookieOptions())
    return res
}
