// `/usage` snapshot repository — all SQL for the `usage_snapshot` table.
// Replaces the on-disk `.usage-cache.json`. Keeps a denormalized `max_percent`
// for the usage gate (see execution-manager.ts), and the full snapshot as JSON.

import 'server-only'
import { prep, getRow } from '@/server/data/db'
import type { UsageSnapshot } from '@/server/domain/types'

function maxPercent(snap: UsageSnapshot): number {
    return snap.entries.reduce((m, e) => Math.max(m, e.percent), 0)
}

// `account` tags the Claude identity a snapshot was fetched under; NULL is the
// ambient host login (the original single-snapshot behaviour). `account IS ?`
// matches both NULL and a literal alias, so one query serves either.
export function saveSnapshot(snap: UsageSnapshot, account: string | null = null): void {
    prep(
        `INSERT INTO usage_snapshot (fetched_at, note, raw, max_percent, entries, account)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(snap.fetchedAt, snap.note, snap.raw, maxPercent(snap), JSON.stringify(snap.entries), account)
}

export function latest(account: string | null = null): UsageSnapshot | null {
    const r = getRow<{ fetched_at: string; note: string | null; raw: string; entries: string }>(
        'SELECT fetched_at, note, raw, entries FROM usage_snapshot WHERE account IS ? ORDER BY id DESC LIMIT 1',
        account,
    )
    if (!r) return null
    let entries: UsageSnapshot['entries']
    try {
        entries = JSON.parse(r.entries)
    } catch {
        entries = []
    }
    return { fetchedAt: r.fetched_at, note: r.note ?? '', raw: r.raw, entries }
}
