// Authentication: GitHub OAuth2 code flow + HMAC-signed httpOnly session cookie
// (§7). All server-side. The GitHub access token is used only during the
// callback and never persisted in the session.
//
// Ported from TaskForge's `server/services/auth.ts`, adapting the role names to
// `owner | standard | guest` and folding TaskForge's separate `roles.ts` policy
// (resolveOnLogin / getRole) in here — Quaykeeper has no standalone roles service.

import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { config } from '@/server/config'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as realmRepo from '@/server/data/repositories/realm-repo'
import * as userRealmRepo from '@/server/data/repositories/user-realm-repo'
import * as ghTokenRepo from '@/server/data/repositories/github-token-repo'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import { tx } from '@/server/data/db'
import { type AppUser, type Role, type SessionPayload } from '@/server/domain/types'
import { meetsMinRole } from '@/server/domain/admin'

export const SESSION_COOKIE = 'quaykeeper_session'
export const STATE_COOKIE = 'quaykeeper_oauth_state'
// The owner's active-realm selection (multiple_realms.md Phase E). A signed httpOnly
// cookie carrying just the chosen realm id — set by the owner-only switcher, read as a
// *hint* by `resolveActiveRealm` (always re-validated against the DB). Non-owners never
// set or use it: they're pinned to their owner-assigned default realm (§0.6).
export const REALM_COOKIE = 'quaykeeper_realm'

/** A GitHub identity, normalized from the `/user` profile response. */
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
    // In production a cookie must always be `secure`, regardless of the redirect-URI
    // scheme (S4): an http redirect URI in prod is a misconfiguration, not a reason to
    // ship session/token cookies over cleartext. Outside production (dev/test), follow
    // the redirect-URI scheme so a plain-http dev loop still works.
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

// ── GitHub access token at rest (private-repo support) ───────────────────────
//
// The token is kept OUT of the session payload (§7) but must survive beyond the
// login request: the create-site wizard lists repos/branches with it for the whole
// session (not just 10 minutes), and nginxpilot needs a valid clone credential for
// private repos on every poll. It is stored AES-256-GCM-encrypted (the realm cipher
// keyring) in `user_github_token`, refreshed on each login, and never sent to the
// client. nginxpilot receives it only via its git-credentials store (0600 files),
// referenced from fragments by path — never inlined in YAML.

/** Seal + upsert a user's GitHub token (called from the OAuth callback). */
export function saveGithubToken(githubId: number, token: string): void {
    ghTokenRepo.set(githubId, encrypt(token), new Date().toISOString())
}

/**
 * The stored GitHub token for a user, decrypted — null when the user has never
 * logged in since token persistence landed, or when the ciphertext no longer
 * opens (a rotated-out cipher key); both heal on the user's next login.
 */
export function getGithubTokenFor(githubId: number): string | null {
    const sealed = ghTokenRepo.get(githubId)
    if (!sealed) return null
    try {
        return decrypt(sealed)
    } catch {
        return null
    }
}

// ── active-realm cookie (owner switcher, multiple_realms.md Phase E) ────────────

/** Cookie options for the active-realm hint — `httpOnly`, signed, scoped to the session lifetime. */
export function realmCookieOptions() {
    return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: isSecure(), maxAge: config.sessionTtl }
}

/** Sign a realm id into a tamper-evident cookie value (still re-validated against the DB on read). */
export function signRealmToken(realmId: string): string {
    return signToken({ r: realmId, exp: Math.floor(Date.now() / 1000) + config.sessionTtl })
}

/** Read + verify the active-realm cookie; returns the realm-id *hint* or null. */
export async function readActiveRealmCookie(): Promise<string | null> {
    const token = (await cookies()).get(REALM_COOKIE)?.value
    const payload = verifyToken<{ r: string; exp: number }>(token)
    if (!payload) return null
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return typeof payload.r === 'string' ? payload.r : null
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

const STATE_TTL_SEC = 600

/**
 * Nonces already redeemed by a callback (S1). A signed `state` token stays valid for
 * its full 10-min TTL, so without this the same `state` + matching cookie could be
 * replayed within the window. We record each nonce on first successful verification
 * and reject a second presentation. The single-process app makes an in-memory `Set`
 * sufficient; a periodic sweep drops entries past their expiry so the set can't grow
 * unbounded. Survives dev hot-reload via `globalThis`.
 */
declare global {
    var __quaykeeperConsumedNonces: Map<string, number> | undefined
}

function consumedNonces(): Map<string, number> {
    if (!globalThis.__quaykeeperConsumedNonces) globalThis.__quaykeeperConsumedNonces = new Map()
    return globalThis.__quaykeeperConsumedNonces
}

/** Drop nonces whose token has already expired (cheap, runs on each verification). */
function sweepConsumedNonces(now: number): void {
    const map = consumedNonces()
    for (const [nonce, exp] of map) {
        if (exp * 1000 < now) map.delete(nonce)
    }
}

export function makeStateToken(): string {
    const nonce = crypto.randomBytes(16).toString('hex')
    return signToken({ n: nonce, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SEC })
}

/**
 * Verify a `state` token's signature + expiry AND mark its nonce consumed (single-use,
 * S1). The first valid presentation returns true and records the nonce; any later
 * presentation of the same nonce (a replay) returns false. The cookie pairing in the
 * callback is the primary CSRF/anti-replay control; this nonce set is best-effort
 * defence-in-depth — it lives in process memory, so a restart within the 10-minute
 * TTL re-opens the replay window for an attacker who ALSO holds the victim's state
 * cookie (which the cookie-pair check still requires).
 */
export function verifyStateToken(token: string | undefined): boolean {
    const payload = verifyToken<{ n: string; exp: number }>(token)
    if (!payload) return false
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return false
    if (typeof payload.n !== 'string' || payload.n === '') return false
    const now = Date.now()
    sweepConsumedNonces(now)
    const map = consumedNonces()
    if (map.has(payload.n)) return false // already redeemed — reject the replay
    map.set(payload.n, payload.exp)
    return true
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(state: string): string {
    // `read:user` identifies the user; `repo` lets the token list AND clone private
    // repositories (OAuth apps have no finer-grained private-repo scope — `repo` is
    // the smallest one that covers both the wizard's repo listing and nginxpilot's
    // interval pulls). An org gate, if configured, additionally needs `read:org`.
    const scope = config.allowedOrg ? 'read:user repo read:org' : 'read:user repo'
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

/** Optional allowlist enforcement (§7) — runs before any role assignment. */
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

// ── role policy (bootstrap owner / per-request re-read) ───────────────────────

/** Authoritative role lookup, re-read each call (§6, §7). */
export function getRole(githubId: number): Role | null {
    return userRepo.get(githubId)?.role ?? null
}

/**
 * Resolve (or create) a user on login. The very first sign-in, when no owner
 * exists yet, bootstraps as `owner`; every subsequent new user lands as
 * `standard` (§6). Returning users keep their role and just have their profile
 * fields refreshed. Runs in a transaction so the `ownerCount` check and the
 * insert can't race a concurrent first login.
 */
export function resolveOnLogin(profile: GithubProfile): AppUser {
    return tx(() => {
        const existing = userRepo.get(profile.githubId)
        if (existing) {
            userRepo.updateProfile(profile.githubId, profile.login, profile.name, profile.avatarUrl)
            return { ...existing, login: profile.login, name: profile.name, avatarUrl: profile.avatarUrl }
        }
        const role: Role = userRepo.ownerCount() === 0 ? 'owner' : 'standard'
        const record: AppUser = {
            githubId: profile.githubId,
            login: profile.login,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            role,
            addedAt: new Date().toISOString(),
        }
        userRepo.insert(record)
        // Grant the new user the global default realm as their assigned operating realm
        // (multiple_realms.md §F.1). Owners implicitly see all realms regardless of grants
        // (role wins, mirroring base-domain tier logic); the grant is still useful as their
        // initial per-user default. Done inline (not via services/realms) to avoid an
        // auth↔realms import cycle. The default realm exists by signup time (ensureSeed runs
        // at boot); if it somehow doesn't yet, this is a harmless no-op.
        const def = realmRepo.getDefault()
        if (def) userRealmRepo.grant(profile.githubId, def.id, true, record.addedAt)
        return record
    })
}

// ── authorization guard (per-request role re-read) ───────────────────────────

export type AuthzResult =
    | { ok: true; session: SessionPayload; role: Role }
    | { ok: false; status: 401 | 403 }

/**
 * Authorize the current request against `minRole`. Re-reads the role straight
 * from SQLite (authoritative) so promotions/suspensions take effect without a
 * re-login, falling back to `guest` for a session whose user row is gone (§6,
 * §7). Returns a discriminated result for route handlers to act on.
 */
export async function authorize(minRole: Role): Promise<AuthzResult> {
    const session = await getSession()
    if (!session) return { ok: false, status: 401 }
    const role = getRole(session.sub) ?? 'guest'
    if (!meetsMinRole(role, minRole)) return { ok: false, status: 403 }
    return { ok: true, session, role }
}
