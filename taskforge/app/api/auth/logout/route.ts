import { NextResponse } from 'next/server'
import { SESSION_COOKIE, clearedCookieOptions } from '@/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', clearedCookieOptions())
    return res
}
