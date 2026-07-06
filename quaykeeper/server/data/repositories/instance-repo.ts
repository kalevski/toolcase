// Instances repository — all SQL for the `instance` + `instance_tag` tables
// (move_wharf_to_perch.md §3). A flat list; tags are the only grouping
// mechanism. Each instance carries its own fetch credential (key_hash); the
// hash + expiry fields are exposed only via dedicated server-only accessors for
// the instance-keys service and the fetch API — never on the public `Instance` type.

import 'server-only'
import { prep, getRow, allRows, tx } from '@/server/data/db'
import type { Instance } from '@/server/domain/types'

interface Raw {
    id: string
    name: string
    description: string | null
    project: string | null
    key_hash: string | null
    key_set_at: string | null
    key_expires_at: string | null
    last_fetch_at: string | null
    created_at: string
    updated_at: string
}

function map(r: Raw, tags: string[]): Instance {
    return {
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        project: r.project ?? undefined,
        tags,
        hasKey: r.key_hash != null,
        keySetAt: r.key_set_at ?? undefined,
        keyExpiresAt: r.key_expires_at ?? undefined,
        lastFetchAt: r.last_fetch_at ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

// ── tags ─────────────────────────────────────────────────────────────────────

export function tagsFor(instanceId: string): string[] {
    return allRows<{ tag: string }>(
        'SELECT tag FROM instance_tag WHERE instance_id = ? ORDER BY tag',
        instanceId,
    ).map((r) => r.tag)
}

/** Replace an instance's whole tag set (the PATCH `tags` contract, §8). */
export function replaceTags(instanceId: string, tags: string[]): void {
    tx(() => {
        prep('DELETE FROM instance_tag WHERE instance_id = ?').run(instanceId)
        const insert = prep('INSERT OR IGNORE INTO instance_tag (instance_id, tag) VALUES (?, ?)')
        for (const tag of tags) insert.run(instanceId, tag)
    })
}

// ── instance CRUD ────────────────────────────────────────────────────────────

export function create(row: {
    id: string
    name: string
    description?: string
    project?: string
    createdAt: string
}): void {
    prep(
        `INSERT INTO instance (id, name, description, project, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.name, row.description ?? null, row.project ?? null, row.createdAt, row.createdAt)
}

export function byId(id: string): Instance | undefined {
    const r = getRow<Raw>('SELECT * FROM instance WHERE id = ?', id)
    return r ? map(r, tagsFor(r.id)) : undefined
}

export function byName(name: string): Instance | undefined {
    const r = getRow<Raw>('SELECT * FROM instance WHERE name = ?', name)
    return r ? map(r, tagsFor(r.id)) : undefined
}

/** All instances, optionally filtered to those carrying `tag`, oldest first. */
export function list(tag?: string): Instance[] {
    const rows = tag
        ? allRows<Raw>(
              `SELECT i.* FROM instance i JOIN instance_tag t ON t.instance_id = i.id
               WHERE t.tag = ? ORDER BY i.created_at`,
              tag,
          )
        : allRows<Raw>('SELECT * FROM instance ORDER BY created_at')
    return rows.map((r) => map(r, tagsFor(r.id)))
}

export function nameTaken(name: string, excludeId?: string): boolean {
    const r = excludeId
        ? getRow<{ n: number }>('SELECT COUNT(*) AS n FROM instance WHERE name = ? AND id != ?', name, excludeId)
        : getRow<{ n: number }>('SELECT COUNT(*) AS n FROM instance WHERE name = ?', name)
    return (r?.n ?? 0) > 0
}

export function update(
    id: string,
    fields: { name?: string; description?: string | null; project?: string | null; updatedAt: string },
): void {
    const sets: string[] = []
    const params: (string | null)[] = []
    if (fields.name !== undefined) {
        sets.push('name = ?')
        params.push(fields.name)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    if (fields.project !== undefined) {
        sets.push('project = ?')
        params.push(fields.project)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE instance SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM instance WHERE id = ?').run(id)
}

// ── key fields (server-only; instance-keys service + fetch API) ────────────

export interface InstanceKeyRecord {
    id: string
    keyHash: string | null
    keyExpiresAt: string | null
}

/** The raw key record for fetch-API auth / key management (never sent to clients). */
export function keyRecord(id: string): InstanceKeyRecord | undefined {
    const r = getRow<Raw>('SELECT * FROM instance WHERE id = ?', id)
    if (!r) return undefined
    return { id: r.id, keyHash: r.key_hash, keyExpiresAt: r.key_expires_at }
}

export function setKey(id: string, keyHash: string, setAt: string, expiresAt: string | null): void {
    prep(
        'UPDATE instance SET key_hash = ?, key_set_at = ?, key_expires_at = ?, updated_at = ? WHERE id = ?',
    ).run(keyHash, setAt, expiresAt, setAt, id)
}

export function clearKey(id: string, at: string): void {
    prep(
        'UPDATE instance SET key_hash = NULL, key_set_at = NULL, key_expires_at = NULL, updated_at = ? WHERE id = ?',
    ).run(at, id)
}

/** Stamp the applied-as-of watermark after a successful fetch-API read (incl. 304s). */
export function touchFetch(id: string, at: string): void {
    prep('UPDATE instance SET last_fetch_at = ? WHERE id = ?').run(at, id)
}
