// `/usage` snapshot repository — all SQL for the `usage_snapshot` table.
// Replaces the on-disk `.usage-cache.json`. Keeps a denormalized `max_percent`
// for the usage gate (see execution-manager.ts), and the full snapshot as JSON.

import 'server-only'
import { prep, getRow } from '@/server/data/db'
import type { UsageSnapshot } from '@/server/domain/types'

function maxPercent(snap: UsageSnapshot): number {
    return snap.entries.reduce((m, e) => Math.max(m, e.percent), 0)
}

export function saveSnapshot(snap: UsageSnapshot): void {
    prep(
        `INSERT INTO usage_snapshot (fetched_at, note, raw, max_percent, entries)
         VALUES (?, ?, ?, ?, ?)`,
    ).run(snap.fetchedAt, snap.note, snap.raw, maxPercent(snap), JSON.stringify(snap.entries))
}

export function latest(): UsageSnapshot | null {
    const r = getRow<{ fetched_at: string; note: string | null; raw: string; entries: string }>(
        'SELECT fetched_at, note, raw, entries FROM usage_snapshot ORDER BY id DESC LIMIT 1',
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
