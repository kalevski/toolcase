// Site repository — all SQL for the `site` table (§9, §12). One deployed (or
// in-progress) static site per row. Raw-SQL CRUD plus hostname-uniqueness
// lookups; the state machine (`draft → provisioning → live → failed|suspended`),
// quota gating, and fragment writing live in services. Every mutation bumps
// `updated_at` so the dashboard can show "last changed".

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Site, SiteHostKind, SiteStatus } from '@/server/domain/types'

interface Raw {
    id: string
    owner_id: number
    repo_owner: string
    repo_name: string
    branch: string
    subdir: string | null
    hostname: string
    host_kind: string
    status: string
    bytes: number | null
    last_ref: string | null
    last_error: string | null
    created_at: string
    updated_at: string
}

function map(r: Raw): Site {
    return {
        id: r.id,
        ownerId: r.owner_id,
        repoOwner: r.repo_owner,
        repoName: r.repo_name,
        branch: r.branch,
        subdir: r.subdir ?? undefined,
        hostname: r.hostname,
        hostKind: r.host_kind as SiteHostKind,
        status: r.status as SiteStatus,
        bytes: r.bytes ?? undefined,
        lastRef: r.last_ref ?? undefined,
        lastError: r.last_error ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

/** Insert a new site. Throws on `id` or `hostname` conflict (hostname is UNIQUE). */
export function create(site: Site): void {
    prep(
        `INSERT INTO site (
            id, owner_id, repo_owner, repo_name, branch, subdir,
            hostname, host_kind, status, bytes, last_ref, last_error,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        site.id,
        site.ownerId,
        site.repoOwner,
        site.repoName,
        site.branch,
        site.subdir ?? null,
        site.hostname,
        site.hostKind,
        site.status,
        site.bytes ?? null,
        site.lastRef ?? null,
        site.lastError ?? null,
        site.createdAt,
        site.updatedAt,
    )
}

export function get(id: string): Site | undefined {
    const r = getRow<Raw>('SELECT * FROM site WHERE id = ?', id)
    return r ? map(r) : undefined
}

/** Sites owned by one user, newest first (the standard-user dashboard list). */
export function listByOwner(ownerId: number): Site[] {
    return allRows<Raw>('SELECT * FROM site WHERE owner_id = ? ORDER BY created_at DESC', ownerId).map(map)
}

/** Every site, newest first (owner moderation view). */
export function list(): Site[] {
    return allRows<Raw>('SELECT * FROM site ORDER BY created_at DESC').map(map)
}

// ── hostname uniqueness ──────────────────────────────────────────────────────
// Subdomain labels and custom domains share one namespace (§10); these lookups
// let a service reject a duplicate before it ever reaches a YAML fragment.

/** The site occupying a hostname, if any. */
export function getByHostname(hostname: string): Site | undefined {
    const r = getRow<Raw>('SELECT * FROM site WHERE hostname = ?', hostname)
    return r ? map(r) : undefined
}

/** Whether a hostname is already taken. */
export function hostnameTaken(hostname: string): boolean {
    return getRow<{ n: number }>('SELECT COUNT(*) AS n FROM site WHERE hostname = ?', hostname)?.n
        ? true
        : false
}

// ── mutations (each bumps updated_at) ────────────────────────────────────────

/** Advance the lifecycle status (e.g. `provisioning → live`). */
export function updateStatus(id: string, status: SiteStatus, at: string = new Date().toISOString()): void {
    prep('UPDATE site SET status = ?, updated_at = ? WHERE id = ?').run(status, at, id)
}

/** Record the last measured deployed size (post-deploy byte-quota check, §11). */
export function updateBytes(id: string, bytes: number, at: string = new Date().toISOString()): void {
    prep('UPDATE site SET bytes = ?, updated_at = ? WHERE id = ?').run(bytes, at, id)
}

/** Record the last live git ref reported by nginxpilot `/status`. */
export function updateLastRef(id: string, lastRef: string, at: string = new Date().toISOString()): void {
    prep('UPDATE site SET last_ref = ?, updated_at = ? WHERE id = ?').run(lastRef, at, id)
}

/** Record (or clear, with `null`) the last deploy/status error. */
export function updateLastError(
    id: string,
    lastError: string | null,
    at: string = new Date().toISOString(),
): void {
    prep('UPDATE site SET last_error = ?, updated_at = ? WHERE id = ?').run(lastError, at, id)
}

/**
 * Rewrite the source branch/subdir (the deploy service's `update`, §9 step 6). The
 * new fragment + reload + sync are the service's job; this only persists the row.
 */
export function updateSource(
    id: string,
    branch: string,
    subdir: string | undefined,
    at: string = new Date().toISOString(),
): void {
    prep('UPDATE site SET branch = ?, subdir = ?, updated_at = ? WHERE id = ?').run(branch, subdir ?? null, at, id)
}

/** Delete a site row (after its fragment + vhost/cert are torn down). */
export function remove(id: string): void {
    prep('DELETE FROM site WHERE id = ?').run(id)
}
