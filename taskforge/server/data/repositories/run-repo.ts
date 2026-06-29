// B1 run history — all SQL for the `run` table. One row per engine run:
// created at start, finalized with reason/counters when the loop ends. The
// per-run terminal replay comes from `run_event` rows carrying this run's id.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'
import type { RunOptions, RunRecord } from '@/server/domain/types'

interface Raw {
    id: number
    project: string
    started_at: string
    finished_at: string | null
    reason: string | null
    options_json: string
    done: number
    error: number
    total: number
    started_by: string | null
    branch: string | null
    pr_url: string | null
}

/**
 * Map a raw row to a RunRecord. `cost` may be supplied pre-computed (the
 * correlated-subquery path used by `list()`, avoiding an N+1); when omitted the
 * cost is resolved per-row via `telemetryRepo.costBetween` (the single-row
 * `get()` path).
 */
function map(r: Raw, cost?: number | null): RunRecord {
    let options: Partial<RunOptions> = {}
    try {
        options = JSON.parse(r.options_json)
    } catch {
        /* tolerate corrupt rows */
    }
    const costUsd =
        cost !== undefined
            ? cost
            : r.finished_at
              ? telemetryRepo.costBetween(r.project, r.started_at, r.finished_at)
              : null
    return {
        id: r.id,
        project: r.project,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        reason: r.reason,
        options,
        done: r.done,
        error: r.error,
        total: r.total,
        startedBy: r.started_by,
        branch: r.branch,
        prUrl: r.pr_url,
        costUsd,
    }
}

/** Insert the row at run start; returns the new run id. */
export function start(project: string, options: RunOptions, startedBy: string | null): number {
    const sanitized: Partial<RunOptions> = { ...options }
    delete sanitized.startedBy
    const res = prep(
        `INSERT INTO run (project, started_at, options_json, started_by)
         VALUES (?, ?, ?, ?)`,
    ).run(project, new Date().toISOString(), JSON.stringify(sanitized), startedBy)
    return Number(res.lastInsertRowid)
}

export function setBranch(id: number, branch: string): void {
    prep('UPDATE run SET branch = ? WHERE id = ?').run(branch, id)
}

export function setPrUrl(id: number, url: string): void {
    prep('UPDATE run SET pr_url = ? WHERE id = ?').run(url, id)
}

export function finalize(id: number, reason: string, done: number, error: number, total: number): void {
    prep(
        `UPDATE run SET finished_at = ?, reason = ?, done = ?, error = ?, total = ? WHERE id = ?`,
    ).run(new Date().toISOString(), reason, done, error, total, id)
}

export function list(project: string, limit = 50): RunRecord[] {
    // COR-2 — fold the per-run cost into the listing query via a correlated
    // subquery (mirrors telemetryRepo.costBetween) instead of one costBetween
    // call per row, so listing N runs is a single query, not N+1.
    return allRows<Raw & { cost: number | null }>(
        `SELECT id, project, started_at, finished_at, reason, options_json, done, error, total,
                started_by, branch, pr_url,
                (SELECT SUM(t.cost_usd) FROM telemetry t
                   WHERE t.project = run.project
                     AND run.finished_at IS NOT NULL
                     AND t.created_at >= run.started_at
                     AND t.created_at <= run.finished_at) AS cost
         FROM run WHERE project = ? ORDER BY id DESC LIMIT ?`,
        project,
        limit,
    ).map((r) => map(r, r.cost ?? null))
}

export function get(project: string, id: number): RunRecord | null {
    const r = getRow<Raw>(
        `SELECT id, project, started_at, finished_at, reason, options_json, done, error, total,
                started_by, branch, pr_url
         FROM run WHERE project = ? AND id = ?`,
        project,
        id,
    )
    return r ? map(r) : null
}

/**
 * The persisted event frames of one run, in order (terminal replay). Fetches
 * `limit + 1` rows to detect truncation: when more than `limit` frames exist the
 * extra row is dropped and `truncated` is set, mirroring the `patchTruncated`
 * pattern so the UI can flag a partial log instead of silently cutting it (IMP-3).
 */
export function events(
    runId: number,
    limit = 2000,
): { events: { type: string; payload: string; createdAt: string }[]; truncated: boolean } {
    const rows = allRows<{ type: string; payload: string; created_at: string }>(
        `SELECT type, payload, created_at FROM run_event WHERE run_id = ? ORDER BY id LIMIT ?`,
        runId,
        limit + 1,
    )
    const truncated = rows.length > limit
    const kept = truncated ? rows.slice(0, limit) : rows
    return {
        events: kept.map((r) => ({ type: r.type, payload: r.payload, createdAt: r.created_at })),
        truncated,
    }
}
