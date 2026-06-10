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

function map(r: Raw): RunRecord {
    let options: Partial<RunOptions> = {}
    try {
        options = JSON.parse(r.options_json)
    } catch {
        /* tolerate corrupt rows */
    }
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
        costUsd: r.finished_at ? telemetryRepo.costBetween(r.project, r.started_at, r.finished_at) : null,
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
    return allRows<Raw>(
        `SELECT id, project, started_at, finished_at, reason, options_json, done, error, total,
                started_by, branch, pr_url
         FROM run WHERE project = ? ORDER BY id DESC LIMIT ?`,
        project,
        limit,
    ).map(map)
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

/** The persisted event frames of one run, in order (terminal replay). */
export function events(runId: number, limit = 2000): { type: string; payload: string; createdAt: string }[] {
    return allRows<{ type: string; payload: string; created_at: string }>(
        `SELECT type, payload, created_at FROM run_event WHERE run_id = ? ORDER BY id LIMIT ?`,
        runId,
        limit,
    ).map((r) => ({ type: r.type, payload: r.payload, createdAt: r.created_at }))
}
