// Project membership repository — SQL for the `project_member` table
// (planning §4 v2, §2.2). The project-scoped access layer on top of the global
// role. Business rules live in services/members.ts.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { AppUser, ProjectMember, ProjectMemberRow, ProjectRole } from '@/server/domain/types'

interface Raw {
    id: string
    project_id: string
    github_id: number
    project_role: string
    granted_by: number
    granted_at: string
}

function map(r: Raw): ProjectMember {
    return {
        id: r.id,
        projectId: r.project_id,
        githubId: r.github_id,
        projectRole: r.project_role as ProjectRole,
        grantedBy: r.granted_by,
        grantedAt: r.granted_at,
    }
}

/** The caller's membership on a project, or undefined (drives guardProject). */
export function getMembership(projectId: string, githubId: number): ProjectMember | undefined {
    const r = getRow<Raw>(
        'SELECT * FROM project_member WHERE project_id = ? AND github_id = ?',
        projectId,
        githubId,
    )
    return r ? map(r) : undefined
}

export function insert(m: ProjectMember): void {
    prep(
        `INSERT INTO project_member (id, project_id, github_id, project_role, granted_by, granted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(m.id, m.projectId, m.githubId, m.projectRole, m.grantedBy, m.grantedAt)
}

export function updateRole(projectId: string, githubId: number, role: ProjectRole): void {
    prep('UPDATE project_member SET project_role = ? WHERE project_id = ? AND github_id = ?').run(
        role,
        projectId,
        githubId,
    )
}

export function remove(projectId: string, githubId: number): void {
    prep('DELETE FROM project_member WHERE project_id = ? AND github_id = ?').run(projectId, githubId)
}

export function countByProject(projectId: string): number {
    const r = getRow<{ n: number }>(
        'SELECT COUNT(*) AS n FROM project_member WHERE project_id = ?',
        projectId,
    )
    return r?.n ?? 0
}

interface RowWithUser extends Raw {
    login: string
    name: string
    avatar_url: string | null
    global_role: string
    added_at: string
}

/** Members of a project, joined with their GitHub profiles (members page). */
export function listByProject(projectId: string): ProjectMemberRow[] {
    const rows = allRows<RowWithUser>(
        `SELECT m.*, u.login, u.name, u.avatar_url, u.role AS global_role, u.added_at
         FROM project_member m JOIN app_user u ON u.github_id = m.github_id
         WHERE m.project_id = ? ORDER BY m.granted_at`,
        projectId,
    )
    return rows.map((r) => ({
        member: map(r),
        user: {
            githubId: r.github_id,
            login: r.login,
            name: r.name,
            avatarUrl: r.avatar_url ?? undefined,
            role: r.global_role as AppUser['role'],
            addedAt: r.added_at,
        },
    }))
}
