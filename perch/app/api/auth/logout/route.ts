import { NextResponse } from 'next/server'
import { GH_TOKEN_COOKIE, SESSION_COOKIE, clearedCookieOptions } from '@/server/services/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', clearedCookieOptions())
    res.cookies.set(GH_TOKEN_COOKIE, '', clearedCookieOptions())
    return res
}
