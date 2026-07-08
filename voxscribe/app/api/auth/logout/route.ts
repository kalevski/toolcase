import { NextResponse } from 'next/server'
import { SESSION_COOKIE, clearedCookieOptions, getSession } from '@/server/services/auth'
import * as auditRepo from '@/server/data/repositories/audit-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const session = await getSession()
    if (session) {
        try {
            auditRepo.append({ githubId: session.sub, login: session.login, action: 'auth.logout' })
        } catch {
            /* best-effort */
        }
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, '', clearedCookieOptions())
    return res
}
