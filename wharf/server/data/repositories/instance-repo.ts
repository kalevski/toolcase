// Instances repository — SQL for the `instance` table (planning §4 v3). Each
// instance carries its own fetch credential (key_hash); the hash + raw key fields
// are exposed only via dedicated server-only accessors for the instance-keys
// service (Phase 5) and the Agent API — never on the public `Instance` type.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Instance } from '@/server/domain/types'

interface Raw {
    id: string
    environment_id: string
    name: string
    key_hash: string | null
    key_set_at: string | null
    key_expires_at: string | null
    last_fetch_at: string | null
    created_at: string
}

function map(r: Raw): Instance {
    return {
        id: r.id,
        environmentId: r.environment_id,
        name: r.name,
        hasKey: r.key_hash != null,
        keySetAt: r.key_set_at ?? undefined,
        keyExpiresAt: r.key_expires_at ?? undefined,
        lastFetchAt: r.last_fetch_at ?? undefined,
        createdAt: r.created_at,
    }
}

export function create(i: { id: string; environmentId: string; name: string; createdAt: string }): void {
    prep(
        `INSERT INTO instance (id, environment_id, name, created_at) VALUES (?, ?, ?, ?)`,
    ).run(i.id, i.environmentId, i.name, i.createdAt)
}

export function byId(id: string): Instance | undefined {
    const r = getRow<Raw>('SELECT * FROM instance WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byEnvAndName(environmentId: string, name: string): Instance | undefined {
    const r = getRow<Raw>('SELECT * FROM instance WHERE environment_id = ? AND name = ?', environmentId, name)
    return r ? map(r) : undefined
}

export function listByEnvironment(environmentId: string): Instance[] {
    return allRows<Raw>('SELECT * FROM instance WHERE environment_id = ? ORDER BY created_at', environmentId).map(
        map,
    )
}

export function rename(id: string, name: string): void {
    prep('UPDATE instance SET name = ? WHERE id = ?').run(name, id)
}

export function remove(id: string): void {
    prep('DELETE FROM instance WHERE id = ?').run(id)
}

export function countByProject(projectId: string): number {
    const r = getRow<{ n: number }>(
        `SELECT COUNT(*) AS n FROM instance i
         JOIN environment e ON e.id = i.environment_id WHERE e.project_id = ?`,
        projectId,
    )
    return r?.n ?? 0
}

export function countByEnvironment(environmentId: string): number {
    const r = getRow<{ n: number }>(
        'SELECT COUNT(*) AS n FROM instance WHERE environment_id = ?',
        environmentId,
    )
    return r?.n ?? 0
}

// ── key fields (server-only; Phase 5 instance-keys + Agent API) ────────────────

export interface InstanceKeyRecord {
    id: string
    environmentId: string
    keyHash: string | null
    keyExpiresAt: string | null
    lastFetchAt: string | null
}

/** The raw key record for Agent-API auth / key management (never sent to clients). */
export function keyRecord(id: string): InstanceKeyRecord | undefined {
    const r = getRow<Raw>('SELECT * FROM instance WHERE id = ?', id)
    if (!r) return undefined
    return {
        id: r.id,
        environmentId: r.environment_id,
        keyHash: r.key_hash,
        keyExpiresAt: r.key_expires_at,
        lastFetchAt: r.last_fetch_at,
    }
}

export function setKey(id: string, keyHash: string, setAt: string, expiresAt: string | null): void {
    prep('UPDATE instance SET key_hash = ?, key_set_at = ?, key_expires_at = ? WHERE id = ?').run(
        keyHash,
        setAt,
        expiresAt,
        id,
    )
}

export function clearKey(id: string): void {
    prep('UPDATE instance SET key_hash = NULL, key_set_at = NULL, key_expires_at = NULL WHERE id = ?').run(id)
}

/** Stamp the applied-as-of watermark after a successful Agent-API fetch (§3.2). */
export function touchFetch(id: string, at: string): void {
    prep('UPDATE instance SET last_fetch_at = ? WHERE id = ?').run(at, id)
}
