// Realm service (multiple_realms.md §4) — the seam every realm-aware path goes
// through. A "realm" is one registered nginxpilot instance the control plane drives.
// This module owns four duties:
//
//   1. Owner CRUD over the realm registry (list/create/remove/set-default/rotate-token/
//      test), with URL validation (§9 SSRF) and the admin token encrypted at rest (§B.1).
//   2. Connection + client resolution — turn a realm id (or a site's `realmId`, or the
//      active realm) into a `nginxpilotClient` bound to that instance (the load-bearing
//      helpers `clientFor*`). The decrypted token never leaves the server.
//   3. Active-realm resolution — owner → signed cookie hint (re-validated) else the global
//      default; non-owner → their owner-assigned per-user default (no switching, §0.6).
//   4. Per-user grants — list/grant/revoke/set-default, plus the boot `ensureSeed` that
//      registers the env instance as the default realm and backfills existing rows (§2.2/2.3).
//
// Server-only. Pure URL-shape checks could move to domain/ later; for now they live here.

import 'server-only'
import { randomBytes } from 'node:crypto'
import * as realmRepo from '@/server/data/repositories/realm-repo'
import * as userRealmRepo from '@/server/data/repositories/user-realm-repo'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as baseDomainRepo from '@/server/data/repositories/base-domain-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import {
    nginxpilotClient,
    NginxpilotError,
    type NginxpilotClient,
    type RealmConnection,
} from '@/server/infrastructure/nginxpilot'
import { readActiveRealmCookie } from '@/server/services/auth'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import type { Realm, Role, Site, UserRealmGrant } from '@/server/domain/types'
import type { StoredRealm } from '@/server/data/repositories/realm-repo'

/**
 * A realm-service refusal: a malformed/blocked URL or body (`400`), a missing realm/user
 * (`404`), a conflict such as removing a realm that still has sites or revoking a realm a
 * user owns sites in (`409`), or an unreachable instance during a test (`503`). Carries the
 * machine-readable `code` and HTTP `status` a route returns (mirrors the other services).
 */
export class RealmError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409 | 503,
    ) {
        super(message)
        this.name = 'RealmError'
    }
}

/** The acting owner, derived from the session — attributed on every audit entry. */
export interface RealmActor {
    githubId: number
    login: string
}

function audit(actor: RealmActor, action: string, detail: string): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, site: null, detail })
}

// ── DTO masking + connection resolution ────────────────────────────────────────

/** Mask a stored realm to the client DTO — the token becomes a boolean, never a value (§9). */
function toDto(r: StoredRealm): Realm {
    return {
        id: r.id,
        name: r.name,
        adminUrl: r.adminUrl,
        hasToken: r.tokenEnc !== null && r.tokenEnc !== '',
        isDefault: r.isDefault,
        createdAt: r.createdAt,
    }
}

/** The decrypted, server-only connection for a stored realm (`''` token = unauthenticated). */
function connectionOf(r: StoredRealm): RealmConnection {
    return { adminUrl: r.adminUrl, adminToken: r.tokenEnc ? decrypt(r.tokenEnc) : '' }
}

/** A short, server-generated realm id (12 url-safe chars). */
function generateRealmId(): string {
    return randomBytes(9).toString('base64url')
}

// ── reads (owner) ───────────────────────────────────────────────────────────────

/** Every realm, masked (no token). Owner-only surface. */
export function listRealms(): Realm[] {
    return realmRepo.list().map(toDto)
}

/** One realm by id, masked. Undefined when unknown. */
export function getRealm(id: string): Realm | undefined {
    const r = realmRepo.byId(id)
    return r ? toDto(r) : undefined
}

// ── connection + client resolution (load-bearing, §4) ───────────────────────────

/** The decrypted connection for a realm id (server-only). Throws `RealmError` 404 when unknown. */
export function connectionFor(realmId: string): RealmConnection {
    const r = realmRepo.byId(realmId)
    if (!r) throw new RealmError(`realm "${realmId}" not found`, 'realm_not_found', 404)
    return connectionOf(r)
}

/** An nginxpilot client bound to a realm id. Throws `RealmError` 404 when unknown. */
export function clientFor(realmId: string): NginxpilotClient {
    return nginxpilotClient(connectionFor(realmId))
}

/** An nginxpilot client bound to the caller's ACTIVE realm — the realm-selected-op helper (§E.2). */
export async function clientForActive(githubId: number, role: Role): Promise<NginxpilotClient> {
    const active = await resolveActiveRealm(githubId, role)
    return clientFor(active.id)
}

/** An nginxpilot client bound to a site's own realm (`site.realmId`). The realm-scoped-op helper. */
export function clientForSite(site: Site): NginxpilotClient {
    if (!site.realmId) {
        // Backfill should have set this at boot; surface a clear error rather than hitting
        // a phantom default if it somehow didn't (§9 backfill correctness).
        throw new RealmError(
            `site "${site.id}" has no realm assigned`,
            'site_realm_unassigned',
            409,
        )
    }
    return clientFor(site.realmId)
}

// ── active-realm resolution (§E.1) ───────────────────────────────────────────────

/** The global default realm (stored), or undefined before the seed runs. */
function defaultRealmStored(): StoredRealm | undefined {
    return realmRepo.getDefault()
}

/**
 * Resolve the realm the current request operates on for realm-SELECTED ops (routing,
 * base-domain pool, create-site, nginx-test):
 *
 *   • owner    → the signed `perch_realm` cookie's realm if it still exists, else the
 *     global default. The cookie is owner-only and a *hint* — always re-validated here.
 *   • non-owner → ALWAYS their owner-assigned per-user default realm (the cookie is
 *     ignored — they can't switch, §0.6). Falls back to the global default if they have none.
 *
 * Always returns a concrete `Realm` (throws `RealmError` 409 only if no realm exists at all,
 * which can't happen after `ensureSeed`).
 */
export async function resolveActiveRealm(githubId: number, role: Role): Promise<Realm> {
    // Lazy seed guard (multiple_realms.md §B.4): cheap once `seedDone`, but guarantees a
    // default realm exists even if boot instrumentation didn't run (e.g. a cold serverless
    // invocation) before the first realm-aware request.
    ensureSeed()
    if (role === 'owner') {
        const hint = await readActiveRealmCookie()
        if (hint) {
            const r = realmRepo.byId(hint)
            if (r) return toDto(r)
        }
        const def = defaultRealmStored()
        if (def) return toDto(def)
    } else {
        const own = userRealmRepo.getUserDefault(githubId)
        if (own) {
            const r = realmRepo.byId(own)
            if (r) return toDto(r)
        }
        const def = defaultRealmStored()
        if (def) return toDto(def)
    }
    throw new RealmError('no realm is configured', 'no_realm', 409)
}

/**
 * The realms a caller may see: the owner sees ALL (the switcher lists them); a non-owner
 * sees only their assigned operating realm (no switcher) — at most one. Mirrors the
 * base-domain tier logic (role wins for the owner).
 */
export function realmsVisibleTo(githubId: number, role: Role): Realm[] {
    if (role === 'owner') return listRealms()
    const own = userRealmRepo.getUserDefault(githubId)
    const id = own ?? defaultRealmStored()?.id
    if (!id) return []
    const r = realmRepo.byId(id)
    return r ? [toDto(r)] : []
}

/** Whether `role === 'owner'` — only the owner manages and switches realms (§0.6). */
export function canSwitchRealms(role: Role): boolean {
    return role === 'owner'
}

// ── URL validation (SSRF, §9) ────────────────────────────────────────────────────

/** Hosts that should never be a realm target unless explicitly allow-listed (cloud metadata). */
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata'])

/** Glob match for the optional allowlist (`*.example.com` style; `*` = any label run). */
function hostMatchesGlob(host: string, glob: string): boolean {
    const re = new RegExp(
        '^' +
            glob
                .toLowerCase()
                .split('*')
                .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('.*') +
            '$',
    )
    return re.test(host.toLowerCase())
}

/**
 * Validate + normalize a realm admin URL (§9 SSRF surface). Requires `http(s)://`, strips a
 * trailing `/`, blocks the cloud-metadata host, and — when `PERCH_REALM_URL_ALLOWLIST` is
 * set — requires the host to match one of the globs. Owner-only registration is the primary
 * control; this is defense in depth. Returns the normalized URL. Throws `RealmError` 400.
 */
export function validateAdminUrl(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new RealmError('"adminUrl" is required', 'invalid_request', 400)
    }
    let url: URL
    try {
        url = new URL(raw.trim())
    } catch {
        throw new RealmError('admin URL is not a valid URL', 'invalid_url', 400)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new RealmError('admin URL must be http(s)://', 'invalid_url_scheme', 400)
    }
    const host = url.hostname.toLowerCase()
    const allowlist = config.realmUrlAllowlist
    if (allowlist.length > 0) {
        if (!allowlist.some((glob) => hostMatchesGlob(host, glob))) {
            throw new RealmError(
                `admin URL host "${host}" is not in the allowlist`,
                'url_not_allowed',
                400,
            )
        }
    } else if (BLOCKED_HOSTS.has(host)) {
        throw new RealmError(`admin URL host "${host}" is blocked`, 'url_blocked', 400)
    }
    // Normalize: drop a trailing slash on the path so `${adminUrl}${apiPath}` is clean.
    return url.toString().replace(/\/+$/, '')
}

// ── owner CRUD ────────────────────────────────────────────────────────────────────

/**
 * Register a realm (`POST /api/admin/realms`): validate the name + URL, encrypt the token
 * (empty → unauthenticated), and persist. The first realm registered becomes the default.
 * Returns the masked DTO.
 */
export function createRealm(
    actor: RealmActor,
    input: { name?: unknown; adminUrl?: unknown; token?: unknown },
): Realm {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) throw new RealmError('"name" is required', 'invalid_request', 400)
    const adminUrl = validateAdminUrl(input.adminUrl)
    const token = typeof input.token === 'string' ? input.token.trim() : ''

    const isFirst = realmRepo.count() === 0
    const id = generateRealmId()
    const createdAt = new Date().toISOString()
    realmRepo.create(
        { id, name, adminUrl, isDefault: isFirst, createdAt },
        token ? encrypt(token) : null,
    )
    audit(actor, 'admin.realm.create', `${name} → ${adminUrl}${isFirst ? ' (default)' : ''}`)
    slog('info', 'realms', 'realm created', {
        id,
        name,
        adminUrl,
        default: isFirst,
        by: actor.login,
    })
    return toDto({
        id,
        name,
        adminUrl,
        tokenEnc: token ? 'set' : null,
        isDefault: isFirst,
        createdAt,
    })
}

/** Rename a realm (`PATCH …{ name }`). Throws 404 when unknown. */
export function renameRealm(actor: RealmActor, id: string, rawName: unknown): Realm {
    const r = realmRepo.byId(id)
    if (!r) throw new RealmError('realm not found', 'realm_not_found', 404)
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    if (!name) throw new RealmError('"name" is required', 'invalid_request', 400)
    realmRepo.rename(id, name)
    audit(actor, 'admin.realm.rename', `${r.name} → ${name}`)
    return toDto({ ...r, name })
}

/** Rotate (or clear, with an empty string) a realm's admin token (`PATCH …{ token }`). */
export function rotateRealmToken(actor: RealmActor, id: string, rawToken: unknown): Realm {
    const r = realmRepo.byId(id)
    if (!r) throw new RealmError('realm not found', 'realm_not_found', 404)
    const token = typeof rawToken === 'string' ? rawToken.trim() : ''
    realmRepo.setToken(id, token ? encrypt(token) : null)
    audit(actor, 'admin.realm.rotate_token', `${r.name}: ${token ? 'token set' : 'token cleared'}`)
    slog('info', 'realms', 'realm token rotated', { id, by: actor.login })
    return toDto({ ...r, tokenEnc: token ? 'set' : null })
}

/** Make a realm the global default (`PATCH …{ default: true }`). Throws 404 when unknown. */
export function setDefaultRealm(actor: RealmActor, id: string): Realm {
    const r = realmRepo.byId(id)
    if (!r) throw new RealmError('realm not found', 'realm_not_found', 404)
    if (!r.isDefault) realmRepo.setDefault(id)
    audit(actor, 'admin.realm.set_default', r.name)
    slog('info', 'realms', 'default realm set', { id, by: actor.login })
    return toDto({ ...r, isDefault: true })
}

/**
 * Remove a realm (`DELETE`). Blocked (`409`) when it still has sites or base domains, or when
 * it is the default and other realms exist (re-default first) (§9 removal guards).
 */
export function removeRealm(actor: RealmActor, id: string): void {
    const r = realmRepo.byId(id)
    if (!r) throw new RealmError('realm not found', 'realm_not_found', 404)

    const sites = siteRepo.countByRealm(id)
    if (sites > 0) {
        throw new RealmError(`realm "${r.name}" still has ${sites} site(s)`, 'realm_has_sites', 409)
    }
    const bases = baseDomainRepo.countByRealm(id)
    if (bases > 0) {
        throw new RealmError(
            `realm "${r.name}" still has ${bases} base domain(s)`,
            'realm_has_base_domains',
            409,
        )
    }
    if (r.isDefault && realmRepo.count() > 1) {
        throw new RealmError(
            'set another realm as default before removing this one',
            'realm_is_default',
            409,
        )
    }

    realmRepo.remove(id)
    audit(actor, 'admin.realm.remove', r.name)
    slog('info', 'realms', 'realm removed', { id, name: r.name, by: actor.login })
}

/** Outcome of a live realm credential/URL check (`POST …/test`). */
export interface RealmTestResult {
    ok: boolean
    /** Daemon answered `GET /healthz` 2xx. */
    healthz: boolean
    /** Daemon runs in managed mode (the `/status` envelope carried an `nginx` object). */
    managed: boolean
    /** A short error string when the check failed (unreachable / auth rejected). */
    error?: string
}

/**
 * Live-check a realm's URL + credentials (`POST /api/admin/realms/{id}/test`): hit `healthz`
 * and `status` against the instance. Never throws on a connection/auth failure — it folds
 * the failure into `ok: false` + `error` so the UI's health dot can render it.
 */
export async function testRealm(id: string): Promise<RealmTestResult> {
    const r = realmRepo.byId(id)
    if (!r) throw new RealmError('realm not found', 'realm_not_found', 404)
    const client = nginxpilotClient(connectionOf(r))
    const healthz = await client.healthz()
    if (!healthz) return { ok: false, healthz: false, managed: false, error: 'unreachable' }
    try {
        const status = await client.status()
        return { ok: true, healthz: true, managed: status.nginx?.managed ?? false }
    } catch (err) {
        const msg =
            err instanceof NginxpilotError
                ? `status ${err.status ?? ''}`.trim()
                : 'status check failed'
        return { ok: false, healthz: true, managed: false, error: msg }
    }
}

// ── per-user grants (owner; §F) ─────────────────────────────────────────────────

/** A user's realm grants, with realm names, for the owner roster. */
export function listUserRealms(githubId: number): UserRealmGrant[] {
    return userRealmRepo.listForUser(githubId)
}

/** Whether a user is granted a realm (guards any path taking a realm id from the request). */
export function hasAccess(githubId: number, realmId: string): boolean {
    return userRealmRepo.hasAccess(githubId, realmId)
}

/**
 * Replace a user's whole realm grant set + default (`PUT /api/admin/users/{id}/realms`). The
 * default must be one of the granted realms (or null). Blocked (`409`) when the new set drops
 * a realm the user still owns sites in (§10.3 — block with a clear message). Audited.
 */
export function replaceUserRealms(
    actor: RealmActor,
    githubId: number,
    realmIds: string[],
    defaultRealmId: string | null,
): UserRealmGrant[] {
    const target = userRepo.get(githubId)
    if (!target) throw new RealmError('user not found', 'user_not_found', 404)

    const unique = [...new Set(realmIds)]
    for (const id of unique) {
        if (!realmRepo.byId(id))
            throw new RealmError(`realm "${id}" not found`, 'realm_not_found', 404)
    }
    if (defaultRealmId !== null && !unique.includes(defaultRealmId)) {
        throw new RealmError(
            'default realm must be one of the granted realms',
            'invalid_default',
            400,
        )
    }

    // Block dropping a realm the user still owns sites in (§10.3).
    const current = userRealmRepo.listForUser(githubId)
    for (const grant of current) {
        if (
            !unique.includes(grant.realmId) &&
            siteRepo.countByOwnerInRealm(githubId, grant.realmId) > 0
        ) {
            throw new RealmError(
                `${target.login} still owns sites in realm "${grant.realmName}" — delete them before revoking`,
                'realm_has_user_sites',
                409,
            )
        }
    }

    // If no explicit default but exactly one realm granted, make it the default.
    const effectiveDefault = defaultRealmId ?? (unique.length === 1 ? unique[0] : null)
    userRealmRepo.replaceForUser(githubId, unique, effectiveDefault, new Date().toISOString())
    audit(
        actor,
        'admin.user.realms',
        `${target.login}: [${unique.join(',') || 'none'}]${effectiveDefault ? ` default=${effectiveDefault}` : ''}`,
    )
    slog('info', 'realms', 'user realms replaced', {
        login: target.login,
        count: unique.length,
        by: actor.login,
    })
    return userRealmRepo.listForUser(githubId)
}

/** Grant a new user the global default realm on signup (multiple_realms.md §F.1). No-op if no default. */
export function grantDefaultRealmOnSignup(githubId: number): void {
    const def = defaultRealmStored()
    if (!def) return
    userRealmRepo.grant(githubId, def.id, true, new Date().toISOString())
}

// ── boot seed + backfill (§2.2 / §2.3) ───────────────────────────────────────────

let seedDone = false

/**
 * Idempotent boot seed (called from `instrumentation.register` and lazily). When the realm
 * table is empty, register the env-config instance (`PERCH_NGINXPILOT_ADMIN_URL`/`TOKEN`) as
 * the single default realm — so an upgraded single-instance deployment behaves exactly as
 * before. Then backfill every pre-realms `site`/`base_domain` to the default realm and grant
 * every existing user access to it (their assigned realm). Safe to call repeatedly.
 */
export function ensureSeed(): void {
    if (seedDone) return
    try {
        if (realmRepo.count() === 0 && config.nginxpilotAdminUrl) {
            const id = generateRealmId()
            const token = config.nginxpilotAdminToken
            realmRepo.create(
                {
                    id,
                    name: 'default',
                    adminUrl: config.nginxpilotAdminUrl.replace(/\/+$/, ''),
                    isDefault: true,
                    createdAt: new Date().toISOString(),
                },
                token ? encrypt(token) : null,
            )
            slog('info', 'realms', 'seeded default realm from env', {
                id,
                adminUrl: config.nginxpilotAdminUrl,
            })
        }

        const def = defaultRealmStored()
        if (def) {
            const sites = siteRepo.backfillRealm(def.id)
            const bases = baseDomainRepo.backfillRealm(def.id)
            userRealmRepo.grantAllUsers(def.id, new Date().toISOString())
            if (sites || bases) {
                slog('info', 'realms', 'backfilled rows to default realm', {
                    sites,
                    bases,
                    realm: def.id,
                })
            }
        } else {
            // No default realm AND orphan rows → the seed couldn't run (env unset) but data
            // exists. Surface it loudly so the operator registers a realm and re-assigns (§9).
            const orphans = siteRepo.countOrphans() + baseDomainRepo.countOrphans()
            if (orphans > 0) {
                slog(
                    'error',
                    'realms',
                    'orphan sites/base-domains with no realm — register a realm',
                    { orphans },
                )
            }
        }
        seedDone = true
    } catch (err) {
        // Don't cache failure — let a later call retry (e.g. DB not ready at first import).
        slog('error', 'realms', 'ensureSeed failed', { error: (err as Error).message })
    }
}

// ── error → HTTP mapping (so routes stay thin) ──────────────────────────────────

export interface HttpError {
    status: number
    code: string
}

/** Map any realm-operation error to its HTTP status + code (messages never forwarded). */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof RealmError) return { status: err.status, code: err.code }
    if (err instanceof NginxpilotError) return { status: 502, code: 'nginxpilot_error' }
    return { status: 500, code: 'internal_error' }
}
