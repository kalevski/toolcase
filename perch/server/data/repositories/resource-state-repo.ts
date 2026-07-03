// Resource-state repository — all SQL for the `resource_state` episode table
// (perch_better.md B1). One row per non-active EPISODE of a managed-mode resource;
// the partial unique index guarantees at most one OPEN row per (realm, kind, key).
// The status poller (`services/status-poll.ts`) is the only writer.

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { OpenEpisode } from '@/server/domain/resource-state'

/** One episode row as the UI's history drawer consumes it. */
export interface ResourceEpisode {
    id: number
    realmId: string
    kind: string
    key: string
    state: string
    reason: string | null
    since: string | null
    firstSeen: string
    lastSeen: string
    clearedAt: string | null
    actorLogin: string | null
    actorAction: string | null
    actorAt: string | null
}

interface Raw {
    id: number
    realm_id: string
    kind: string
    key: string
    state: string
    reason: string | null
    since: string | null
    first_seen: string
    last_seen: string
    cleared_at: string | null
    actor_login: string | null
    actor_action: string | null
    actor_at: string | null
}

function map(r: Raw): ResourceEpisode {
    return {
        id: r.id,
        realmId: r.realm_id,
        kind: r.kind,
        key: r.key,
        state: r.state,
        reason: r.reason,
        since: r.since,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        clearedAt: r.cleared_at,
        actorLogin: r.actor_login,
        actorAction: r.actor_action,
        actorAt: r.actor_at,
    }
}

const COLS =
    'id, realm_id, kind, key, state, reason, since, first_seen, last_seen, cleared_at, actor_login, actor_action, actor_at'

/** Every OPEN episode of a realm, in the differ's input shape. */
export function openEpisodes(realmId: string): OpenEpisode[] {
    return allRows<Raw>(
        `SELECT ${COLS} FROM resource_state WHERE realm_id = ? AND cleared_at IS NULL`,
        realmId,
    ).map((r) => ({ id: r.id, kind: r.kind, key: r.key, state: r.state, reason: r.reason ?? undefined }))
}

/** Open a new episode (the differ said so). Attribution is denormalized at open time. */
export function openEpisode(row: {
    realmId: string
    kind: string
    key: string
    state: string
    reason?: string
    since?: string
    at: string
    actorLogin?: string | null
    actorAction?: string | null
    actorAt?: string | null
}): void {
    prep(
        `INSERT INTO resource_state
            (realm_id, kind, key, state, reason, since, first_seen, last_seen, actor_login, actor_action, actor_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.realmId,
        row.kind,
        row.key,
        row.state,
        row.reason ?? null,
        row.since ?? null,
        row.at,
        row.at,
        row.actorLogin ?? null,
        row.actorAction ?? null,
        row.actorAt ?? null,
    )
}

/** Close an open episode (recovered, disappeared, or superseded by a state change). */
export function closeEpisode(id: number, at: string): void {
    prep('UPDATE resource_state SET cleared_at = ?, last_seen = ? WHERE id = ?').run(at, at, id)
}

/** Bump an open episode the poll still sees (and track the latest reason). */
export function touchEpisode(id: number, at: string, reason?: string): void {
    prep('UPDATE resource_state SET last_seen = ?, reason = COALESCE(?, reason) WHERE id = ?').run(
        at,
        reason ?? null,
        id,
    )
}

/** Episode history for one resource, newest-first (the UI history drawer). */
export function history(realmId: string, kind: string, key: string, limit = 50): ResourceEpisode[] {
    return allRows<Raw>(
        `SELECT ${COLS} FROM resource_state
         WHERE realm_id = ? AND kind = ? AND key = ?
         ORDER BY id DESC LIMIT ?`,
        realmId,
        kind,
        key,
        Math.min(limit, 200),
    ).map(map)
}

/** Recent episodes across a whole realm, newest-first (a realm-level drawer/overview). */
export function recentForRealm(realmId: string, limit = 100): ResourceEpisode[] {
    return allRows<Raw>(
        `SELECT ${COLS} FROM resource_state WHERE realm_id = ? ORDER BY id DESC LIMIT ?`,
        realmId,
        Math.min(limit, 500),
    ).map(map)
}
