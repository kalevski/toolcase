// Authentication: GitHub OAuth2 code flow + HMAC-signed httpOnly session cookie
// (blueprint §services/auth, planning §2.1, §11). All server-side. The GitHub
// access token is used only during the callback and never persisted.
//
// Role lives in the DB (`app_user.role`), perch-style: the first sign-in
// bootstraps to `owner`, every subsequent login is a `guest` until granted
// project membership. `authorize` re-reads the live role per request.

import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { config } from '@/server/config'
import * as userRepo from '@/server/data/repositories/user-repo'
import { tx } from '@/server/data/db'
import { ROLE_RANK, type AppUser, type Role, type SessionPayload } from '@/server/domain/types'

export const SESSION_COOKIE = 'wharf_session'
export const STATE_COOKIE = 'wharf_oauth_state'

export interface GithubProfile {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
}

// ── base64url + HMAC token primitives ────────────────────────────────────────

function b64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url')
}
function hmac(data: string): string {
    return crypto.createHmac('sha256', config.authSecret).update(data).digest('base64url')
}
function signToken(obj: unknown): string {
    const payload = b64url(JSON.stringify(obj))
    return `${payload}.${hmac(payload)}`
}
function verifyToken<T = any>(token: string | undefined): T | null {
    if (!token) return null
    const dot = token.lastIndexOf('.')
    if (dot <= 0) return null
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const a = Buffer.from(sig)
    const b = Buffer.from(hmac(payload))
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
    } catch {
        return null
    }
}

// ── session cookie ────────────────────────────────────────────────────────────

export function makeSessionToken(profile: GithubProfile, role: Role): string {
    const now = Math.floor(Date.now() / 1000)
    const payload: SessionPayload = {
        sub: profile.githubId,
        login: profile.login,
        role,
        iat: now,
        exp: now + config.sessionTtl,
    }
    return signToken(payload)
}

function isSecure(): boolean {
    return config.oauthRedirectUri.startsWith('https://')
}
export function sessionCookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isSecure(), maxAge: config.sessionTtl }
}
export function clearedCookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isSecure(), maxAge: 0 }
}
export function stateCookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isSecure(), maxAge: 600 }
}

function verifySession(token: string | undefined): SessionPayload | null {
    const payload = verifyToken<SessionPayload>(token)
    if (!payload) return null
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return payload
}

export async function getSession(): Promise<SessionPayload | null> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    return verifySession(token)
}

// ── OAuth state (CSRF, single-use) ────────────────────────────────────────────

export function makeStateToken(): string {
    const nonce = crypto.randomBytes(16).toString('hex')
    return signToken({ n: nonce, exp: Math.floor(Date.now() / 1000) + 600 })
}
export function verifyStateToken(token: string | undefined): boolean {
    const payload = verifyToken<{ n: string; exp: number }>(token)
    if (!payload) return false
    return typeof payload.exp === 'number' && payload.exp * 1000 >= Date.now()
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
    return { githubId: u.id, login: u.login, name: u.name || u.login, avatarUrl: u.avatar_url }
}

export async function checkAllowlist(profile: GithubProfile, token: string): Promise<boolean> {
    if (config.allowedLogins.length > 0) {
        const login = profile.login.toLowerCase()
        if (!config.allowedLogins.some((l) => l.toLowerCase() === login)) return false
    }
    if (config.allowedOrg) {
        try {
            const res = await fetch(
                `https://api.github.com/user/memberships/orgs/${encodeURIComponent(config.allowedOrg)}`,
                { cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
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

// ── role policy (bootstrap owner / per-request re-read) ───────────────────────

/** Authoritative global-role lookup, re-read each call. */
export function getRole(githubId: number): Role | null {
    return userRepo.get(githubId)?.role ?? null
}

/**
 * Resolve (or create) a user on login. The very first sign-in (no owner yet)
 * bootstraps as `owner`; every subsequent new user lands as `guest` (planning
 * §2.1). Returning users keep their role; profile fields are refreshed. In a tx so
 * the ownerCount check + insert can't race a concurrent first login.
 */
export function resolveOnLogin(profile: GithubProfile): AppUser {
    return tx(() => {
        const existing = userRepo.get(profile.githubId)
        if (existing) {
            userRepo.updateProfile(profile.githubId, profile.login, profile.name, profile.avatarUrl)
            return { ...existing, login: profile.login, name: profile.name, avatarUrl: profile.avatarUrl }
        }
        const role: Role = userRepo.ownerCount() === 0 ? 'owner' : 'guest'
        const record: AppUser = {
            githubId: profile.githubId,
            login: profile.login,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            role,
            addedAt: new Date().toISOString(),
        }
        userRepo.insert(record)
        return record
    })
}

// ── authorization guard (per-request global-role re-read) ─────────────────────

export type AuthzResult =
    | { ok: true; session: SessionPayload; role: Role }
    | { ok: false; status: 401 | 403 }

/**
 * Authorize the current request against a global `minRole`, re-reading the role
 * from SQLite (authoritative) so promotions take effect without re-login, falling
 * back to `guest` for a session whose user row is gone.
 */
export async function authorize(minRole: Role): Promise<AuthzResult> {
    const session = await getSession()
    if (!session) return { ok: false, status: 401 }
    const role = getRole(session.sub) ?? 'guest'
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) return { ok: false, status: 403 }
    return { ok: true, session, role }
}
