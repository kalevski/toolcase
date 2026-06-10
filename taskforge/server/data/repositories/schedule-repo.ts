// B3 scheduled runs — all SQL for the `schedule` table (one schedule per project).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { RunOptions, ScheduleRecord } from '@/server/domain/types'

interface Raw {
    project: string
    cron: string
    options_json: string
    enabled: number
    only_if_pending: number
    skip_above_usage: number | null
    last_fired_at: string | null
}

function map(r: Raw): ScheduleRecord {
    let options: Partial<RunOptions> = {}
    try {
        options = JSON.parse(r.options_json)
    } catch {
        /* tolerate corrupt rows */
    }
    return {
        project: r.project,
        cron: r.cron,
        options,
        enabled: r.enabled === 1,
        onlyIfPending: r.only_if_pending === 1,
        skipAboveUsage: r.skip_above_usage,
        lastFiredAt: r.last_fired_at,
    }
}

export function get(project: string): ScheduleRecord | null {
    const r = getRow<Raw>('SELECT * FROM schedule WHERE project = ?', project)
    return r ? map(r) : null
}

export function listEnabled(): ScheduleRecord[] {
    return allRows<Raw>('SELECT * FROM schedule WHERE enabled = 1').map(map)
}

export function upsert(rec: Omit<ScheduleRecord, 'lastFiredAt'>): void {
    prep(
        `INSERT INTO schedule (project, cron, options_json, enabled, only_if_pending, skip_above_usage)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project) DO UPDATE SET
            cron             = excluded.cron,
            options_json     = excluded.options_json,
            enabled          = excluded.enabled,
            only_if_pending  = excluded.only_if_pending,
            skip_above_usage = excluded.skip_above_usage`,
    ).run(
        rec.project,
        rec.cron,
        JSON.stringify(rec.options),
        rec.enabled ? 1 : 0,
        rec.onlyIfPending ? 1 : 0,
        rec.skipAboveUsage,
    )
}

export function remove(project: string): void {
    prep('DELETE FROM schedule WHERE project = ?').run(project)
}

export function markFired(project: string): void {
    prep('UPDATE schedule SET last_fired_at = ? WHERE project = ?').run(new Date().toISOString(), project)
}
