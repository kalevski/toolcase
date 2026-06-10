// D3 audit log — all SQL for the `audit` table. Who did what, when, to which
// project. Writes are best-effort (callers never block a mutation on audit).

import 'server-only'
import { prep, allRows, getRow } from '@/server/data/db'
import type { AuditRecord } from '@/server/domain/types'

export function append(entry: {
    githubId: number | null
    login: string | null
    action: string
    project?: string | null
    detail?: string | null
}): void {
    prep(
        `INSERT INTO audit (at, github_id, login, action, project, detail)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
        new Date().toISOString(),
        entry.githubId,
        entry.login,
        entry.action,
        entry.project ?? null,
        entry.detail ? entry.detail.slice(0, 500) : null,
    )
}

export interface AuditFilter {
    project?: string
    login?: string
    action?: string
    limit?: number
    beforeId?: number
}

export function list(filter: AuditFilter = {}): AuditRecord[] {
    const where: string[] = []
    const params: (string | number)[] = []
    if (filter.project) {
        where.push('project = ?')
        params.push(filter.project)
    }
    if (filter.login) {
        where.push('login = ?')
        params.push(filter.login)
    }
    if (filter.action) {
        where.push('action LIKE ?')
        params.push(`${filter.action}%`)
    }
    if (filter.beforeId) {
        where.push('id < ?')
        params.push(filter.beforeId)
    }
    const sql = `SELECT id, at, github_id, login, action, project, detail FROM audit
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY id DESC LIMIT ?`
    params.push(Math.min(filter.limit ?? 100, 500))
    return allRows<{
        id: number
        at: string
        github_id: number | null
        login: string | null
        action: string
        project: string | null
        detail: string | null
    }>(sql, ...params).map((r) => ({
        id: r.id,
        at: r.at,
        githubId: r.github_id,
        login: r.login,
        action: r.action,
        project: r.project,
        detail: r.detail,
    }))
}

/** Distinct action names seen so far (filter dropdown). */
export function actions(): string[] {
    return allRows<{ action: string }>('SELECT DISTINCT action FROM audit ORDER BY action').map((r) => r.action)
}

export function count(): number {
    return getRow<{ n: number }>('SELECT COUNT(*) AS n FROM audit')?.n ?? 0
}
