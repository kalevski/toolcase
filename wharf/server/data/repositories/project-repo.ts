// Projects repository — SQL for the `project` table (planning §4 v2).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Project } from '@/server/domain/types'

interface Raw {
    id: string
    name: string
    slug: string
    created_by: number
    created_at: string
}

function map(r: Raw): Project {
    return { id: r.id, name: r.name, slug: r.slug, createdBy: r.created_by, createdAt: r.created_at }
}

export function create(p: Project): void {
    prep(
        `INSERT INTO project (id, name, slug, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(p.id, p.name, p.slug, p.createdBy, p.createdAt)
}

export function byId(id: string): Project | undefined {
    const r = getRow<Raw>('SELECT * FROM project WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function bySlug(slug: string): Project | undefined {
    const r = getRow<Raw>('SELECT * FROM project WHERE slug = ?', slug)
    return r ? map(r) : undefined
}

export function slugExists(slug: string): boolean {
    return !!getRow<{ n: number }>('SELECT 1 AS n FROM project WHERE slug = ?', slug)
}

/** Every project, newest first (owner view). */
export function listAll(): Project[] {
    return allRows<Raw>('SELECT * FROM project ORDER BY created_at DESC').map(map)
}

/** Projects the given user is a member of, newest first (non-owner view). */
export function listForUser(githubId: number): Project[] {
    return allRows<Raw>(
        `SELECT p.* FROM project p
         JOIN project_member m ON m.project_id = p.id
         WHERE m.github_id = ?
         ORDER BY p.created_at DESC`,
        githubId,
    ).map(map)
}

export function rename(id: string, name: string, slug: string): void {
    prep('UPDATE project SET name = ?, slug = ? WHERE id = ?').run(name, slug, id)
}

export function remove(id: string): void {
    prep('DELETE FROM project WHERE id = ?').run(id)
}
