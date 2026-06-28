// Audit-log repository — all SQL for the `audit` table (planning §4 v1, §11).
// Who did what, when, to which project. Append-only; writes are best-effort
// (callers never block a mutation on the audit write). Cursor-paginated reads
// (gap-13); a retention prune drops rows older than AUDIT_RETENTION_DAYS (gap-3).

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { AuditEntry } from '@/server/domain/types'

/** Append one entry. `at` defaults to now; `detail` is truncated to 500 chars. */
export function append(entry: {
    githubId: number | null
    login: string | null
    action: string
    projectId?: string | null
    detail?: string | null
    at?: string
}): void {
    prep(
        `INSERT INTO audit (at, github_id, login, action, detail, project_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
        entry.at ?? new Date().toISOString(),
        entry.githubId,
        entry.login,
        entry.action,
        entry.detail ? entry.detail.slice(0, 500) : null,
        entry.projectId ?? null,
    )
}

interface Raw {
    id: number
    at: string
    github_id: number | null
    login: string | null
    action: string
    detail: string | null
    project_id: string | null
}

function map(r: Raw): AuditEntry {
    return {
        id: r.id,
        at: r.at,
        githubId: r.github_id,
        login: r.login,
        action: r.action,
        projectId: r.project_id,
        detail: r.detail,
    }
}

export interface AuditFilter {
    /** Restrict to one project (omit for the global owner view). */
    projectId?: string
    /** Restrict to actions starting with this prefix (e.g. `secret.`). */
    action?: string
    /** Keyset pagination — only entries older than this id (gap-13). */
    beforeId?: number
    /** Page size; clamped to 500. Default 100. */
    limit?: number
}

/** List entries newest-first (id DESC), with optional filters + keyset paging. */
export function list(filter: AuditFilter = {}): AuditEntry[] {
    const where: string[] = []
    const params: (string | number)[] = []
    if (filter.projectId) {
        where.push('project_id = ?')
        params.push(filter.projectId)
    }
    if (filter.action) {
        where.push('action LIKE ?')
        params.push(`${filter.action}%`)
    }
    if (filter.beforeId) {
        where.push('id < ?')
        params.push(filter.beforeId)
    }
    const sql = `SELECT id, at, github_id, login, action, detail, project_id FROM audit
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY id DESC LIMIT ?`
    params.push(Math.min(filter.limit ?? 100, 500))
    return allRows<Raw>(sql, ...params).map(map)
}

/** Retention prune — delete entries older than `beforeIso` (gap-3). Returns rows removed. */
export function pruneBefore(beforeIso: string): number {
    const info = prep('DELETE FROM audit WHERE at < ?').run(beforeIso)
    return Number(info.changes ?? 0)
}
