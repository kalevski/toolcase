// Audit-log repository — all SQL for the `audit` table (§12, §16). Who did what,
// when, to which site. Append-only; writes are best-effort (callers never block a
// mutation on the audit write). Mirrors TaskForge's `audit-repo.ts`.

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { AuditEntry } from '@/server/domain/types'

/** Append one entry. `at` defaults to now; `detail` is truncated to 500 chars. */
export function append(entry: {
    githubId: number | null
    login: string | null
    action: string
    site?: string | null
    detail?: string | null
    at?: string
}): void {
    prep(
        `INSERT INTO audit (at, github_id, login, action, site, detail)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
        entry.at ?? new Date().toISOString(),
        entry.githubId,
        entry.login,
        entry.action,
        entry.site ?? null,
        entry.detail ? entry.detail.slice(0, 500) : null,
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
    }
}

export interface AuditFilter {
    /** Restrict to one acting login. */
    login?: string
    /** Restrict to one affected site id/hostname. */
    site?: string
    /** Restrict to actions starting with this prefix (e.g. `site.`). */
    action?: string
    /** Keyset pagination — only entries older than this id. */
    beforeId?: number
    /** Page size; clamped to 500. Default 100. */
    limit?: number
}

/** List entries newest-first (id DESC), with optional filters + keyset paging. */
export function list(filter: AuditFilter = {}): AuditEntry[] {
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
        where.push('action LIKE ?')
        params.push(`${filter.action}%`)
    }
    if (filter.beforeId) {
        where.push('id < ?')
        params.push(filter.beforeId)
    }
    const sql = `SELECT id, at, github_id, login, action, site, detail FROM audit
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY id DESC LIMIT ?`
    params.push(Math.min(filter.limit ?? 100, 500))
    return allRows<Raw>(sql, ...params).map(map)
}
