// Per-attempt telemetry repository — all SQL for the `telemetry` table.
// Replaces the hourly-rotated `telemetry-*.jsonl` files + the read-all-and-merge
// in logs.ts. "Latest per task" is a single indexed query.

import 'server-only'
import { prep, tx, allRows, getRow } from '@/server/data/db'
import type { TelemetryRecord, TelemetrySummary } from '@/server/domain/types'

export function record(project: string, rec: TelemetryRecord): void {
    prep(
        `INSERT INTO telemetry (project, task, status, elapsed, model, commit_sha, error, created_at,
                                tokens_in, tokens_out, cost_usd, review, review_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        project,
        rec.task,
        rec.status,
        rec.elapsed,
        rec.model,
        rec.commit ?? null,
        rec.error ?? null,
        rec.timestamp,
        rec.tokensIn ?? null,
        rec.tokensOut ?? null,
        rec.costUsd ?? null,
        rec.review ?? null,
        rec.reviewNote ?? null,
    )
}

/** B8 — attach the reviewer verdict to the latest attempt row for a task. */
export function setReview(project: string, task: string, review: 'pass' | 'fail', note: string): void {
    prep(
        `UPDATE telemetry SET review = ?, review_note = ?
         WHERE id = (SELECT MAX(id) FROM telemetry WHERE project = ? AND task = ?)`,
    ).run(review, note.slice(0, 500), project, task)
}

interface Raw {
    task: string
    status: string
    elapsed: number
    model: string
    commit_sha: string | null
    error: string | null
    created_at: string
    tokens_in: number | null
    tokens_out: number | null
    cost_usd: number | null
    review: string | null
    review_note: string | null
}

const RAW_COLS =
    't.task, t.status, t.elapsed, t.model, t.commit_sha, t.error, t.created_at, ' +
    't.tokens_in, t.tokens_out, t.cost_usd, t.review, t.review_note'

function map(r: Raw): TelemetryRecord {
    return {
        task: r.task,
        status: r.status as TelemetryRecord['status'],
        elapsed: r.elapsed,
        model: r.model,
        commit: r.commit_sha ?? undefined,
        timestamp: r.created_at,
        error: r.error ?? undefined,
        tokensIn: r.tokens_in ?? undefined,
        tokensOut: r.tokens_out ?? undefined,
        costUsd: r.cost_usd ?? undefined,
        review: r.review === 'pass' || r.review === 'fail' ? r.review : undefined,
        reviewNote: r.review_note ?? undefined,
    }
}

/** Latest attempt per task id for a project (latest-wins by autoincrement id). */
export function latestByTask(project: string): Map<string, TelemetryRecord> {
    const rows = allRows<Raw>(
        `SELECT ${RAW_COLS}
         FROM telemetry t
         JOIN (SELECT task, MAX(id) AS max_id FROM telemetry WHERE project = ? GROUP BY task) m
           ON t.task = m.task AND t.id = m.max_id
         WHERE t.project = ?`,
        project,
        project,
    )
    const out = new Map<string, TelemetryRecord>()
    for (const r of rows) out.set(r.task, map(r))
    return out
}

/** Drop every telemetry record for the given task ids (used when reopening). */
export function clearForTasks(project: string, ids: string[]): void {
    if (ids.length === 0) return
    tx(() => {
        const stmt = prep('DELETE FROM telemetry WHERE project = ? AND task = ?')
        for (const id of ids) stmt.run(project, id)
    })
}

/** A2 — re-key telemetry history when a task file is renamed (reorder). */
export function renameTask(project: string, fromId: string, toId: string): void {
    prep('UPDATE telemetry SET task = ? WHERE project = ? AND task = ?').run(toId, project, fromId)
}

/** B1 — summed cost of attempts recorded inside a time window (per-run total). */
export function costBetween(project: string, fromIso: string, toIso: string): number | null {
    const r = getRow<{ total: number | null }>(
        `SELECT SUM(cost_usd) AS total FROM telemetry
         WHERE project = ? AND created_at >= ? AND created_at <= ?`,
        project,
        fromIso,
        toIso,
    )
    return r?.total ?? null
}

// ── D1 dashboard aggregates ───────────────────────────────────────────────────

/** Aggregates for the project Overview charts. `days` bounds the per-day series. */
export function summary(project: string, days = 30): TelemetrySummary {
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    const perDay = allRows<{ date: string; done: number; error: number; cost: number | null }>(
        `SELECT substr(created_at, 1, 10) AS date,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END) AS error,
                SUM(cost_usd) AS cost
         FROM telemetry WHERE project = ? AND created_at >= ?
         GROUP BY date ORDER BY date`,
        project,
        since,
    ).map((r) => ({ date: r.date, done: r.done, error: r.error, costUsd: r.cost ?? 0 }))

    const perModel = allRows<{ model: string; count: number; avg: number; cost: number | null }>(
        `SELECT model, COUNT(*) AS count, AVG(elapsed) AS avg, SUM(cost_usd) AS cost
         FROM telemetry WHERE project = ? AND created_at >= ?
         GROUP BY model ORDER BY count DESC`,
        project,
        since,
    ).map((r) => ({
        model: r.model,
        count: r.count,
        avgElapsed: Math.round(r.avg * 10) / 10,
        costUsd: r.cost ?? 0,
    }))

    const slowest = allRows<{ task: string; elapsed: number; model: string }>(
        `SELECT task, MAX(elapsed) AS elapsed, model FROM telemetry
         WHERE project = ? GROUP BY task ORDER BY elapsed DESC LIMIT 5`,
        project,
    )

    const expensive = allRows<{ task: string; cost: number; model: string }>(
        `SELECT task, SUM(cost_usd) AS cost, model FROM telemetry
         WHERE project = ? AND cost_usd IS NOT NULL GROUP BY task ORDER BY cost DESC LIMIT 5`,
        project,
    ).map((r) => ({ task: r.task, costUsd: r.cost, model: r.model }))

    const retried = allRows<{ task: string; attempts: number }>(
        `SELECT task, COUNT(*) AS attempts FROM telemetry
         WHERE project = ? GROUP BY task HAVING attempts > 1 ORDER BY attempts DESC LIMIT 5`,
        project,
    )

    const totalsRow = getRow<{
        done: number
        error: number
        cost: number | null
        tin: number | null
        tout: number | null
    }>(
        `SELECT SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END) AS error,
                SUM(cost_usd) AS cost, SUM(tokens_in) AS tin, SUM(tokens_out) AS tout
         FROM telemetry WHERE project = ?`,
        project,
    )

    return {
        perDay,
        perModel,
        slowest,
        expensive,
        retried,
        totals: {
            done: totalsRow?.done ?? 0,
            error: totalsRow?.error ?? 0,
            costUsd: totalsRow?.cost ?? 0,
            tokensIn: totalsRow?.tin ?? 0,
            tokensOut: totalsRow?.tout ?? 0,
        },
    }
}

/** Global per-day cost across all projects (Dashboard card). */
export function globalCostPerDay(days = 30): { date: string; costUsd: number }[] {
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    return allRows<{ date: string; cost: number | null }>(
        `SELECT substr(created_at, 1, 10) AS date, SUM(cost_usd) AS cost
         FROM telemetry WHERE created_at >= ? GROUP BY date ORDER BY date`,
        since,
    ).map((r) => ({ date: r.date, costUsd: r.cost ?? 0 }))
}
