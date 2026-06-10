// Edge middleware — intentionally thin (§4.1, §10).
//
// It only checks that a session cookie is *present* and redirects anonymous
// visitors to /login (pages) or returns 401 (API). The cryptographic
// verification (HMAC + expiry) and the authoritative per-request role re-read
// from roles.json happen in the Node layer (`authorize()` / page guards), where
// `fs` and `crypto` are available — so role changes apply without re-login.

import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'atm_session'

// Paths that never require a session. `/api/health` (exact) is the D4 liveness
// probe for Docker HEALTHCHECK — details stay admin-gated at /api/health/details.
const PUBLIC_PREFIXES = ['/login', '/api/auth/github']
const PUBLIC_EXACT = ['/api/health']

function isPublic(pathname: string): boolean {
    if (PUBLIC_EXACT.includes(pathname)) return true
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

    // Behind a reverse proxy, `req.url` carries the internal listen host
    // (e.g. 0.0.0.0:3000). Rebuild the redirect from the forwarded headers the
    // proxy sets so the browser is sent to the public origin, not the container.
    const fwdHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    const fwdProto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
    const base = fwdHost ? `${fwdProto}://${fwdHost}` : req.url

    const loginUrl = new URL('/login', base)
    return NextResponse.redirect(loginUrl)
}

export const config = {
    // Run on everything except Next internals and static assets.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
