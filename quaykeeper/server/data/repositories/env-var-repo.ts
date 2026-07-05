// Environment-variables repository — all SQL for the `env_var` table
// (move_wharf_to_perch.md §3). One row per key per instance; exactly one
// source (literal / global / secret), enforced by the table's CHECK
// constraint. Repo returns raw rows; the service builds the resolved/joined
// shape.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { EnvVarSource } from '@/server/domain/types'

export interface EnvVarRow {
    id: string
    instanceId: string
    key: string
    source: EnvVarSource
    value?: string
    globalVarId?: string
    secretId?: string
    description?: string
    createdAt: string
    updatedAt: string
}

interface Raw {
    id: string
    instance_id: string
    key: string
    source: string
    value: string | null
    global_var_id: string | null
    secret_id: string | null
    description: string | null
    created_at: string
    updated_at: string
}

function map(r: Raw): EnvVarRow {
    return {
        id: r.id,
        instanceId: r.instance_id,
        key: r.key,
        source: r.source as EnvVarSource,
        value: r.value ?? undefined,
        globalVarId: r.global_var_id ?? undefined,
        secretId: r.secret_id ?? undefined,
        description: r.description ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function listByInstance(instanceId: string): EnvVarRow[] {
    return allRows<Raw>('SELECT * FROM env_var WHERE instance_id = ? ORDER BY key', instanceId).map(map)
}

export function byId(id: string): EnvVarRow | undefined {
    const r = getRow<Raw>('SELECT * FROM env_var WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byInstanceAndKey(instanceId: string, key: string): EnvVarRow | undefined {
    const r = getRow<Raw>('SELECT * FROM env_var WHERE instance_id = ? AND key = ?', instanceId, key)
    return r ? map(r) : undefined
}

export function insert(row: EnvVarRow): void {
    prep(
        `INSERT INTO env_var
           (id, instance_id, key, source, value, global_var_id, secret_id, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.instanceId,
        row.key,
        row.source,
        row.value ?? null,
        row.globalVarId ?? null,
        row.secretId ?? null,
        row.description ?? null,
        row.createdAt,
        row.updatedAt,
    )
}

/**
 * Update a row. When changing `source`, the caller MUST pass `value`/
 * `globalVarId`/`secretId` together (all three) so the write satisfies the
 * table's one-source CHECK constraint — never a partial cross-source patch.
 */
export function update(
    id: string,
    fields: {
        source?: EnvVarSource
        value?: string | null
        globalVarId?: string | null
        secretId?: string | null
        description?: string | null
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | null)[] = []
    if (fields.source !== undefined) {
        sets.push('source = ?')
        params.push(fields.source)
    }
    if (fields.value !== undefined) {
        sets.push('value = ?')
        params.push(fields.value)
    }
    if (fields.globalVarId !== undefined) {
        sets.push('global_var_id = ?')
        params.push(fields.globalVarId)
    }
    if (fields.secretId !== undefined) {
        sets.push('secret_id = ?')
        params.push(fields.secretId)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE env_var SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM env_var WHERE id = ?').run(id)
}

/** Rows referencing a global variable (the ON DELETE RESTRICT pre-check, §3). */
export function listReferencingGlobal(globalVarId: string): EnvVarRow[] {
    return allRows<Raw>('SELECT * FROM env_var WHERE global_var_id = ?', globalVarId).map(map)
}

/** Rows referencing a secret (the ON DELETE RESTRICT pre-check, §3). */
export function listReferencingSecret(secretId: string): EnvVarRow[] {
    return allRows<Raw>('SELECT * FROM env_var WHERE secret_id = ?', secretId).map(map)
}

/**
 * Ids of every instance carrying at least one env var whose row (or referenced
 * global/secret) changed after that instance's `last_fetch_at` (§4's "pending"
 * marker, computed in bulk for the instance list — never fetched yet ⇒ not
 * pending, matching `config-resolution.ts`'s undefined-watermark rule).
 */
export function pendingInstanceIds(): Set<string> {
    const rows = allRows<{ instance_id: string }>(
        `SELECT DISTINCT v.instance_id AS instance_id
         FROM env_var v
         JOIN instance i ON i.id = v.instance_id
         LEFT JOIN global_var g ON v.global_var_id = g.id
         LEFT JOIN secret s ON v.secret_id = s.id
         WHERE i.last_fetch_at IS NOT NULL
           AND (
             v.updated_at > i.last_fetch_at
             OR (g.id IS NOT NULL AND g.updated_at > i.last_fetch_at)
             OR (s.id IS NOT NULL AND s.updated_at > i.last_fetch_at)
           )`,
    )
    return new Set(rows.map((r) => r.instance_id))
}
