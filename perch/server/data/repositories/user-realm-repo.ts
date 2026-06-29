// User-realm grant repository — all SQL for the `user_realm` table (multiple_realms.md
// §B.3). A row = "this user may use this realm". `is_default` marks the user's own
// operating realm among their grants (owner-managed; non-owners never switch, §0.6).
// Business rules (the one-default-per-user invariant, revoke guards, signup default)
// live in `services/realms.ts` / `services/auth.ts`.

import 'server-only'
import { prep, getRow, allRows, tx } from '@/server/data/db'

/** A user's grant on one realm (joined with the realm name for the owner roster). */
export interface GrantRow {
    realmId: string
    realmName: string
    isDefault: boolean
}

interface RawGrant {
    realm_id: string
    realm_name: string
    is_default: number
}

/** Every realm a user is granted, with the realm name, oldest grant first. */
export function listForUser(githubId: number): GrantRow[] {
    return allRows<RawGrant>(
        `SELECT ur.realm_id AS realm_id, r.name AS realm_name, ur.is_default AS is_default
         FROM user_realm ur JOIN realm r ON r.id = ur.realm_id
         WHERE ur.github_id = ?
         ORDER BY ur.granted_at`,
        githubId,
    ).map((r) => ({ realmId: r.realm_id, realmName: r.realm_name, isDefault: r.is_default === 1 }))
}

/**
 * Every grant for every user, keyed by `github_id` — one query for the owner roster
 * (I1). Replaces N per-user `listForUser` calls in `admin.listUsersDetailed`; the row
 * shape per user matches `listForUser` (oldest grant first within each user).
 */
export function allByUser(): Map<number, GrantRow[]> {
    const rows = allRows<RawGrant & { github_id: number }>(
        `SELECT ur.github_id AS github_id, ur.realm_id AS realm_id, r.name AS realm_name, ur.is_default AS is_default
         FROM user_realm ur JOIN realm r ON r.id = ur.realm_id
         ORDER BY ur.github_id, ur.granted_at`,
    )
    const out = new Map<number, GrantRow[]>()
    for (const r of rows) {
        const grant: GrantRow = { realmId: r.realm_id, realmName: r.realm_name, isDefault: r.is_default === 1 }
        const arr = out.get(r.github_id)
        if (arr) arr.push(grant)
        else out.set(r.github_id, [grant])
    }
    return out
}

/** Whether a user is granted a realm. */
export function hasAccess(githubId: number, realmId: string): boolean {
    return getRow<{ n: number }>(
        'SELECT COUNT(*) AS n FROM user_realm WHERE github_id = ? AND realm_id = ?',
        githubId,
        realmId,
    )?.n
        ? true
        : false
}

/** The user's own default realm id among their grants, or undefined when none is marked. */
export function getUserDefault(githubId: number): string | undefined {
    return getRow<{ realm_id: string }>(
        'SELECT realm_id FROM user_realm WHERE github_id = ? AND is_default = 1 LIMIT 1',
        githubId,
    )?.realm_id
}

/** Whether the user has any grant at all. */
export function hasAny(githubId: number): boolean {
    return getRow<{ n: number }>(
        'SELECT COUNT(*) AS n FROM user_realm WHERE github_id = ?',
        githubId,
    )?.n
        ? true
        : false
}

/**
 * Grant a user access to a realm (idempotent — `INSERT OR IGNORE` on the composite PK).
 * `isDefault` marks it as their operating realm; the caller clears any prior default first
 * (use {@link setUserDefault} for an existing grant).
 */
export function grant(
    githubId: number,
    realmId: string,
    isDefault: boolean,
    grantedAt: string,
): void {
    prep(
        `INSERT OR IGNORE INTO user_realm (github_id, realm_id, is_default, granted_at)
         VALUES (?, ?, ?, ?)`,
    ).run(githubId, realmId, isDefault ? 1 : 0, grantedAt)
}

/** Revoke a user's grant on a realm. No-op when absent. */
export function revoke(githubId: number, realmId: string): void {
    prep('DELETE FROM user_realm WHERE github_id = ? AND realm_id = ?').run(githubId, realmId)
}

/**
 * Make `realmId` the user's default operating realm — clear their current default, then set
 * the new one, in one transaction. The realm must already be granted (the service checks).
 */
export function setUserDefault(githubId: number, realmId: string): void {
    tx(() => {
        prep('UPDATE user_realm SET is_default = 0 WHERE github_id = ? AND is_default = 1').run(
            githubId,
        )
        prep('UPDATE user_realm SET is_default = 1 WHERE github_id = ? AND realm_id = ?').run(
            githubId,
            realmId,
        )
    })
}

/**
 * Grant a realm to EVERY existing user (used when seeding the default realm so all
 * pre-realms accounts keep working, multiple_realms.md §2.3). `isDefault` is set only for
 * users who currently have no default (so we never clobber an explicit choice).
 */
export function grantAllUsers(realmId: string, grantedAt: string): void {
    tx(() => {
        prep(
            `INSERT OR IGNORE INTO user_realm (github_id, realm_id, is_default, granted_at)
             SELECT github_id, ?, 0, ? FROM app_user`,
        ).run(realmId, grantedAt)
        // Mark it the default for any user who has no default yet.
        prep(
            `UPDATE user_realm SET is_default = 1
             WHERE realm_id = ?
               AND github_id NOT IN (SELECT github_id FROM user_realm WHERE is_default = 1)`,
        ).run(realmId)
    })
}

/** Replace a user's whole grant set (owner PUT). `defaultRealmId` (if in the set) becomes their default. */
export function replaceForUser(
    githubId: number,
    realmIds: string[],
    defaultRealmId: string | null,
    grantedAt: string,
): void {
    tx(() => {
        prep('DELETE FROM user_realm WHERE github_id = ?').run(githubId)
        const insert = prep(
            'INSERT OR IGNORE INTO user_realm (github_id, realm_id, is_default, granted_at) VALUES (?, ?, ?, ?)',
        )
        for (const realmId of realmIds) {
            insert.run(githubId, realmId, realmId === defaultRealmId ? 1 : 0, grantedAt)
        }
    })
}
