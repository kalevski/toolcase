// Per-user custom limit overrides repository — all SQL for the `user_limit` table
// (§11, §15). A row holds an owner-set partial override of a user's quota limits;
// every column is nullable and a NULL field means "inherit the role/plan default".
// The merge of override-over-default lives in `services/plan.ts` (`resolveLimits`)
// via the pure `mergeLimits`; this layer is only the raw CRUD.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import { NUMERIC_LIMIT_KEYS, type UserLimitOverride } from '@/server/domain/types'

interface Raw {
    github_id: number
    max_sites: number | null
    max_bytes_per_site: number | null
    max_bytes_total: number | null
    min_interval_sec: number | null
    custom_domains: number | null
    keep_releases: number | null
    private_repos: number | null
    updated_at: string
}

/** Map a row to an override carrying only the fields that are actually set (non-NULL). */
function map(r: Raw): UserLimitOverride {
    const o: UserLimitOverride = {}
    if (r.max_sites !== null) o.maxSites = r.max_sites
    if (r.max_bytes_per_site !== null) o.maxBytesPerSite = r.max_bytes_per_site
    if (r.max_bytes_total !== null) o.maxBytesTotal = r.max_bytes_total
    if (r.min_interval_sec !== null) o.minIntervalSec = r.min_interval_sec
    if (r.custom_domains !== null) o.customDomains = r.custom_domains
    if (r.keep_releases !== null) o.keepReleases = r.keep_releases
    if (r.private_repos !== null) o.privateRepos = r.private_repos === 1
    return o
}

/** Whether an override carries no fields (so it should be deleted, not stored). */
function isEmpty(o: UserLimitOverride): boolean {
    return NUMERIC_LIMIT_KEYS.every((k) => o[k] === undefined) && o.privateRepos === undefined
}

/** The override for one user, or `undefined` when they run on pure role/plan defaults. */
export function get(githubId: number): UserLimitOverride | undefined {
    const r = getRow<Raw>('SELECT * FROM user_limit WHERE github_id = ?', githubId)
    return r ? map(r) : undefined
}

/** All overrides keyed by `github_id` — one query backing the admin roster (avoids N reads). */
export function all(): Map<number, UserLimitOverride> {
    const out = new Map<number, UserLimitOverride>()
    for (const r of allRows<Raw>('SELECT * FROM user_limit')) out.set(r.github_id, map(r))
    return out
}

/**
 * Replace a user's override with `override` (only its present fields are stored;
 * the rest are written NULL = inherit). An override with no fields removes the row
 * entirely, so a fully-cleared editor leaves no stray row behind.
 */
export function set(githubId: number, override: UserLimitOverride, updatedAt: string): void {
    if (isEmpty(override)) {
        remove(githubId)
        return
    }
    prep(
        `INSERT INTO user_limit
            (github_id, max_sites, max_bytes_per_site, max_bytes_total,
             min_interval_sec, custom_domains, keep_releases, private_repos, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_id) DO UPDATE SET
            max_sites          = excluded.max_sites,
            max_bytes_per_site = excluded.max_bytes_per_site,
            max_bytes_total    = excluded.max_bytes_total,
            min_interval_sec   = excluded.min_interval_sec,
            custom_domains     = excluded.custom_domains,
            keep_releases      = excluded.keep_releases,
            private_repos      = excluded.private_repos,
            updated_at         = excluded.updated_at`,
    ).run(
        githubId,
        override.maxSites ?? null,
        override.maxBytesPerSite ?? null,
        override.maxBytesTotal ?? null,
        override.minIntervalSec ?? null,
        override.customDomains ?? null,
        override.keepReleases ?? null,
        override.privateRepos === undefined ? null : override.privateRepos ? 1 : 0,
        updatedAt,
    )
}

/** Drop a user's override (idempotent — a no-op when none is set). */
export function remove(githubId: number): void {
    prep('DELETE FROM user_limit WHERE github_id = ?').run(githubId)
}
