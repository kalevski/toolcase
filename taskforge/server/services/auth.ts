// Authentication: GitHub OAuth2 code flow + signed httpOnly session cookie
// (§4.1, §4.4, §10). All server-side. The GitHub access token is used only
// during callback and never persisted.

import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { config } from '@/server/config'
import { getRole } from '@/server/services/roles'
import { ROLE_RANK, type Role, type SessionPayload } from '@/server/domain/types'
import type { GithubProfile } from '@/server/services/roles'

export const SESSION_COOKIE = 'atm_session'
export const STATE_COOKIE = 'atm_oauth_state'

// ── base64url + HMAC token primitives ────────────────────────────────────────

function b64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url')
}

function hmac(data: string): string {
    return crypto.createHmac('sha256', config.authSecret).update(data).digest('base64url')
}

/** Sign an arbitrary JSON object into a `<payload>.<sig>` token. */
function signToken(obj: unknown): string {
    const payload = b64url(JSON.stringify(obj))
    return `${payload}.${hmac(payload)}`
}

/** Verify a `<payload>.<sig>` token; returns the parsed object or null. */
function verifyToken<T = any>(token: string | undefined): T | null {
    if (!token) return null
    const dot = token.lastIndexOf('.')
    if (dot <= 0) return null
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = hmac(payload)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
    } catch {
        return null
    }
}

// ── session cookie ────────────────────────────────────────────────────────────

// The session cookie deliberately carries NO role — authorization re-reads the
// authoritative role from roles.json on every request (see `authorize`), so a
// role embedded here would only be a stale foot-gun (taskforge IMP-4).
export function makeSessionToken(profile: GithubProfile): string {
    const now = Math.floor(Date.now() / 1000)
    const payload: SessionPayload = {
        sub: profile.githubId,
        login: profile.login,
        iat: now,
        exp: now + config.sessionTtl,
    }
    return signToken(payload)
}

function isSecure(): boolean {
    // Force `secure` in production regardless of the redirect URI's scheme —
    // a production deploy behind a TLS-terminating proxy may still carry an
    // http:// internal redirect URI, and the cookie must never ride plain HTTP.
    if (process.env.NODE_ENV === 'production') return true
    return config.oauthRedirectUri.startsWith('https://')
}

export function sessionCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: isSecure(),
        maxAge: config.sessionTtl,
    }
}

export function clearedCookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isSecure(), maxAge: 0 }
}

export function stateCookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isSecure(), maxAge: 600 }
}

/** Verify a session token and check expiry. */
function verifySession(token: string | undefined): SessionPayload | null {
    const payload = verifyToken<SessionPayload>(token)
    if (!payload) return null
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return payload
}

/** Read + verify the session from the request cookies (Node runtime). */
export async function getSession(): Promise<SessionPayload | null> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    return verifySession(token)
}

// ── OAuth state (CSRF, single-use) ────────────────────────────────────────────

// Consumed-nonce set: a state token verifies at most ONCE, so a replayed
// callback URL (leaked log line, history sync) can't complete a second login.
// globalThis so dev hot-reload doesn't reset it; entries self-sweep on expiry.
declare global {
    var __taskforgeConsumedStates: Map<string, number> | undefined
}

function consumedStates(): Map<string, number> {
    return (globalThis.__taskforgeConsumedStates ??= new Map())
}

function sweepConsumedStates(now: number): void {
    for (const [nonce, exp] of consumedStates()) {
        if (exp * 1000 < now) consumedStates().delete(nonce)
    }
}

export function makeStateToken(): string {
    const nonce = crypto.randomBytes(16).toString('hex')
    return signToken({ n: nonce, exp: Math.floor(Date.now() / 1000) + 600 })
}

export function verifyStateToken(token: string | undefined): boolean {
    const payload = verifyToken<{ n: string; exp: number }>(token)
    if (!payload) return false
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return false
    if (typeof payload.n !== 'string' || payload.n === '') return false
    const now = Date.now()
    sweepConsumedStates(now)
    if (consumedStates().has(payload.n)) return false // replay
    consumedStates().set(payload.n, payload.exp)
    return true
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(state: string): string {
    const scope = config.allowedOrg ? 'read:user read:org' : 'read:user'
    const params = new URLSearchParams({
        client_id: config.githubClientId,
        redirect_uri: config.oauthRedirectUri,
        scope,
        state,
        allow_signup: 'false',
    })
    return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            client_id: config.githubClientId,
            client_secret: config.githubClientSecret,
            code,
            redirect_uri: config.oauthRedirectUri,
        }),
    })
    if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`)
    const data = (await res.json()) as { access_token?: string; error?: string }
    if (!data.access_token) throw new Error(`GitHub token exchange error: ${data.error ?? 'no token'}`)
    return data.access_token
}

export async function fetchGithubProfile(token: string): Promise<GithubProfile> {
    const res = await fetch('https://api.github.com/user', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub profile fetch failed: ${res.status}`)
    const u = (await res.json()) as { id: number; login: string; name?: string; avatar_url?: string }
    return {
        githubId: u.id,
        login: u.login,
        name: u.name || u.login,
        avatarUrl: u.avatar_url,
    }
}

/** Optional allowlist enforcement (§4.4) — runs before any role assignment. */
export async function checkAllowlist(profile: GithubProfile, token: string): Promise<boolean> {
    if (config.allowedLogins.length > 0) {
        // GitHub logins are case-insensitive; compare case-folded so a config of
        // `octocat` still matches a user signing in as `OctoCat`.
        const login = profile.login.toLowerCase()
        if (!config.allowedLogins.some((l) => l.toLowerCase() === login)) return false
    }
    if (config.allowedOrg) {
        try {
            const res = await fetch(
                `https://api.github.com/user/memberships/orgs/${encodeURIComponent(config.allowedOrg)}`,
                {
                    cache: 'no-store',
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
                },
            )
            if (!res.ok) return false
            const m = (await res.json()) as { state?: string }
            if (m.state !== 'active') return false
        } catch {
            return false
        }
    }
    return true
}

// ── authorization guard (per-request role re-read) ───────────────────────────

export type AuthzResult =
    | { ok: true; session: SessionPayload; role: Role }
    | { ok: false; status: 401 | 403 }

/**
 * Authorize the current request against `minRole`. Re-reads the role from
 * roles.json (authoritative) so promotions/demotions take effect without
 * re-login. Returns a discriminated result for route handlers to act on.
 */
export async function authorize(minRole: Role): Promise<AuthzResult> {
    const session = await getSession()
    if (!session) return { ok: false, status: 401 }
    const role = (await getRole(session.sub)) ?? 'guest'
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) return { ok: false, status: 403 }
    return { ok: true, session, role }
}
