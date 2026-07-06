// Audit-log repository — all SQL for the `audit` table (§12, §16). Who did what,
// when, to which site. Append-only; writes are best-effort (callers never block a
// mutation on the audit write). Mirrors TaskForge's `audit-repo.ts`.

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { AuditEntry } from '@/server/domain/types'

/** Serialized-snapshot size cap — keeps a pathological object from bloating the log. */
const META_MAX_CHARS = 4000

/**
 * Append one entry. `at` defaults to now; `detail` is truncated to 500 chars.
 * `meta` (B3) is an optional snapshot of the written object — JSON-serialized here,
 * capped, and stored as text; callers MUST strip secrets before passing it (cert
 * keys and credential bodies never reach this function).
 */
export function append(entry: {
    githubId: number | null
    login: string | null
    action: string
    site?: string | null
    detail?: string | null
    meta?: unknown
    at?: string
}): void {
    let meta: string | null = null
    if (entry.meta !== undefined && entry.meta !== null) {
        try {
            const json = JSON.stringify(entry.meta)
            meta = json.length > META_MAX_CHARS ? json.slice(0, META_MAX_CHARS) : json
        } catch {
            meta = null // a non-serializable snapshot is dropped, never blocks the write
        }
    }
    prep(
        `INSERT INTO audit (at, github_id, login, action, site, detail, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        entry.at ?? new Date().toISOString(),
        entry.githubId,
        entry.login,
        entry.action,
        entry.site ?? null,
        entry.detail ? entry.detail.slice(0, 500) : null,
        meta,
    )
}

interface Raw {
    id: number
    at: string
    github_id: number | null
    login: string | null
    action: string
    site: string | null
    detail: string | null
    meta: string | null
}

function map(r: Raw): AuditEntry {
    return {
        id: r.id,
        at: r.at,
        githubId: r.github_id,
        login: r.login,
        action: r.action,
        site: r.site,
        detail: r.detail,
        meta: r.meta,
    }
}

export interface AuditFilter {
    /** Restrict to one acting login. */
    login?: string
    /** Restrict to one affected site id/hostname. */
    site?: string
    /** Restrict to actions starting with this prefix (e.g. `site.`). */
    action?: string
    /**
     * Restrict to one object key (B3) — a domain or pool name. Matches the `site`
     * column, an exact `detail`, or a `detail` starting with `<key> ` (the routing
     * services' convention).
     */
    key?: string
    /** Page size; clamped to 500. Default 100. */
    limit?: number
    /** Offset pagination (impl §8) — rows to skip; combines with `limit` for page N. */
    offset?: number
    /** Sort by id (creation order). Default `desc` (newest first). */
    order?: 'asc' | 'desc'
}

/** Build the shared WHERE clause for {@link list} and {@link count}. */
function whereClause(filter: AuditFilter): { where: string; params: (string | number)[] } {
    const where: string[] = []
    const params: (string | number)[] = []
    if (filter.login) {
        where.push('login = ?')
        params.push(filter.login)
    }
    if (filter.site) {
        where.push('site = ?')
        params.push(filter.site)
    }
    if (filter.action) {
        // Prefix match: escape the LIKE metacharacters (`%`/`_`/the escape char itself) so
        // `site_create` matches only that literal prefix, never `siteXcreate` (C4).
        const escaped = filter.action.replace(/[\\%_]/g, '\\$&')
        where.push("action LIKE ? ESCAPE '\\'")
        params.push(`${escaped}%`)
    }
    if (filter.key) {
        const escaped = filter.key.replace(/[\\%_]/g, '\\$&')
        where.push("(site = ? OR detail = ? OR detail LIKE ? ESCAPE '\\')")
        params.push(filter.key, filter.key, `${escaped} %`)
    }
    return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

/** Total entries matching the filter (ignoring limit/offset) — the pager's `total`. */
export function count(filter: AuditFilter = {}): number {
    const { where, params } = whereClause(filter)
    const row = prep(`SELECT COUNT(*) AS n FROM audit ${where}`).get(...params) as unknown as
        | { n: number }
        | undefined
    return row?.n ?? 0
}

/**
 * The most recent mutation touching one routing/site resource key — the episode
 * attribution lookup (quaykeeper_better.md B1): "failing since Tue, last changed by
 * @login". Matches the conventions the services actually write: routing mutations
 * put the key at the START of `detail` (often with a suffix like `→ target` or
 * `⚠ n warning(s)`), site mutations set the `site` column. Best-effort — returns
 * undefined when nothing matches.
 */
export function lastActorFor(key: string): { login: string; action: string; at: string } | undefined {
    const escaped = key.replace(/[\\%_]/g, '\\$&')
    const row = prep(
        `SELECT login, action, at FROM audit
         WHERE login IS NOT NULL
           AND (action LIKE 'routing.%' OR action LIKE 'site%' OR action LIKE 'admin.cert%')
           AND (site = ? OR detail = ? OR detail LIKE ? ESCAPE '\\')
         ORDER BY id DESC LIMIT 1`,
    ).get(key, key, `${escaped} %`) as unknown as { login: string; action: string; at: string } | undefined
    return row
}

/** List entries (id DESC by default), with optional filters + keyset or offset paging. */
export function list(filter: AuditFilter = {}): AuditEntry[] {
    const { where, params } = whereClause(filter)
    const order = filter.order === 'asc' ? 'ASC' : 'DESC'
    const sql = `SELECT id, at, github_id, login, action, site, detail, meta FROM audit
                 ${where}
                 ORDER BY id ${order} LIMIT ? OFFSET ?`
    params.push(Math.min(filter.limit ?? 100, 500), Math.max(filter.offset ?? 0, 0))
    return allRows<Raw>(sql, ...params).map(map)
}

/**
 * Delete entries older than `beforeIso` (B3 retention). Returns the number removed.
 * Callers pick the horizon; a zero/absent retention setting means "never called".
 */
export function prune(beforeIso: string): number {
    const res = prep('DELETE FROM audit WHERE at < ?').run(beforeIso)
    return Number(res.changes ?? 0)
}
