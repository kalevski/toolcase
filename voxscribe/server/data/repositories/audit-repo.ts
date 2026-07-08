// Audit-log repository — all SQL for the `audit` table. Who did what, when.
// Append-only; writes are best-effort (callers never block a mutation on the
// audit write).

import 'server-only'
import { prep, allRows, getRow } from '@/server/data/db'
import type { AuditEntry } from '@/server/domain/types'

/** Append one entry. `at` defaults to now; `detail` is truncated to 500 chars. */
export function append(entry: {
    githubId: number | null
    login: string | null
    action: string
    detail?: string | null
    at?: string
}): void {
    prep(`INSERT INTO audit (at, github_id, login, action, detail) VALUES (?, ?, ?, ?, ?)`).run(
        entry.at ?? new Date().toISOString(),
        entry.githubId,
        entry.login,
        entry.action,
        entry.detail ? entry.detail.slice(0, 500) : null,
    )
}

interface Raw {
    id: number
    at: string
    github_id: number | null
    login: string | null
    action: string
    detail: string | null
}

function map(r: Raw): AuditEntry {
    return { id: r.id, at: r.at, githubId: r.github_id, login: r.login, action: r.action, detail: r.detail }
}

/** Total entry count — the pager's `total`. */
export function count(): number {
    const r = getRow<{ n: number }>('SELECT COUNT(*) AS n FROM audit')
    return r?.n ?? 0
}

/** List entries newest first with offset paging. `limit` clamped to 500. */
export function list(limit = 100, offset = 0): AuditEntry[] {
    return allRows<Raw>(
        `SELECT id, at, github_id, login, action, detail FROM audit
         ORDER BY id DESC LIMIT ? OFFSET ?`,
        Math.min(limit, 500),
        Math.max(offset, 0),
    ).map(map)
}
