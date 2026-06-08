// Edge middleware — intentionally thin (§4.1, §10).
//
// It only checks that a session cookie is *present* and redirects anonymous
// visitors to /login (pages) or returns 401 (API). The cryptographic
// verification (HMAC + expiry) and the authoritative per-request role re-read
// from roles.json happen in the Node layer (`authorize()` / page guards), where
// `fs` and `crypto` are available — so role changes apply without re-login.

import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'atm_session'

// Paths that never require a session.
const PUBLIC_PREFIXES = ['/login', '/api/auth/github']

function isPublic(pathname: string): boolean {
    return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname === p)
}

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    if (isPublic(pathname)) return NextResponse.next()

    const hasSession = req.cookies.has(SESSION_COOKIE)
    if (hasSession) return NextResponse.next()

    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
}

export const config = {
    // Run on everything except Next internals and static assets.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
