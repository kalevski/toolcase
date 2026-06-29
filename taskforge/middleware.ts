// Edge middleware — intentionally thin (§4.1, §10).
//
// It only checks that a session cookie is *present* and redirects anonymous
// visitors to /login (pages) or returns 401 (API). The cryptographic
// verification (HMAC + expiry) and the authoritative per-request role re-read
// from roles.json happen in the Node layer (`authorize()` / page guards), where
// `fs` and `crypto` are available — so role changes apply without re-login.

import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'atm_session'

/**
 * Operator-configured public origin, from trusted server env only
 * (PUBLIC_ORIGIN, else the origin of OAUTH_REDIRECT_URI). Used to build the
 * login redirect so a spoofed `x-forwarded-host` can't turn an anonymous
 * redirect into an open redirect. Empty when neither is set.
 */
function trustedOrigin(): string {
    const explicit = process.env.PUBLIC_ORIGIN
    if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/+$/, '')
    const redirect = process.env.OAUTH_REDIRECT_URI
    if (redirect) {
        try {
            return new URL(redirect).origin
        } catch {
            /* malformed — fall through to forwarded headers */
        }
    }
    return ''
}

// Paths that never require a session. `/api/health` (exact) is the D4 liveness
// probe for Docker HEALTHCHECK — details stay admin-gated at /api/health/details.
const PUBLIC_PREFIXES = ['/login', '/api/auth/github']
const PUBLIC_EXACT = ['/api/health', '/api/settings']

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

    // Prefer the operator-configured public origin (trusted env). Behind a
    // reverse proxy, `req.url` carries the internal listen host (e.g.
    // 0.0.0.0:3000), so when no public origin is configured we fall back to the
    // forwarded headers the proxy sets — but those are attacker-controllable, so
    // the trusted origin takes precedence to avoid an open redirect.
    const trusted = trustedOrigin()
    let base: string
    if (trusted) {
        base = trusted
    } else {
        const fwdHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
        const fwdProto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
        base = fwdHost ? `${fwdProto}://${fwdHost}` : req.url
    }

    const loginUrl = new URL('/login', base)
    return NextResponse.redirect(loginUrl)
}

export const config = {
    // Run on everything except Next internals and static assets.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
