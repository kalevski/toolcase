// Edge middleware — intentionally thin (blueprint §middleware). Checks only that
// a session cookie is *present* and redirects anonymous visitors to /login
// (pages) or returns 401 (API). HMAC verification + the authoritative role
// re-read happen in the Node layer (`authorize()` / page guards). Same-origin /
// CSRF enforcement on mutations lives in the route layer (planning §11, gap-11).

import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'wharf_session'

function trustedOrigin(): string {
    const explicit = process.env.PUBLIC_ORIGIN
    if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/+$/, '')
    const redirect = process.env.OAUTH_REDIRECT_URI
    if (redirect) {
        try {
            return new URL(redirect).origin
        } catch {
            /* malformed — fall through */
        }
    }
    return ''
}

const PUBLIC_PREFIXES = ['/login', '/api/auth/github']
const PUBLIC_EXACT = ['/api/health']

function isPublic(pathname: string): boolean {
    if (PUBLIC_EXACT.includes(pathname)) return true
    return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl
    if (isPublic(pathname)) return NextResponse.next()

    if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next()

    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const trusted = trustedOrigin()
    let base: string
    if (trusted) {
        base = trusted
    } else {
        const fwdHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
        const fwdProto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
        base = fwdHost ? `${fwdProto}://${fwdHost}` : req.url
    }
    return NextResponse.redirect(new URL('/login', base))
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
