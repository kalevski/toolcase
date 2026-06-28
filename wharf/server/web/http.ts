// Route-handler helpers — the thin seam between API routes and services
// (blueprint §web, planning §9.1, §10). Contract: guard → parse → validate →
// service → audit → json.

import 'server-only'
import { NextResponse } from 'next/server'
import { authorize, getSession, type AuthzResult } from '@/server/services/auth'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as projectRepo from '@/server/data/repositories/project-repo'
import * as memberRepo from '@/server/data/repositories/project-member-repo'
import {
    PROJECT_ROLE_RANK,
    type ProjectRole,
    type Role,
    type SessionPayload,
} from '@/server/domain/types'

export function json(data: unknown, status = 200): NextResponse {
    return NextResponse.json(data, { status })
}

export function error(message: string, status: number): NextResponse {
    return NextResponse.json({ error: message }, { status })
}

/** Guard a route by minimum GLOBAL role. Returns the authorized result or a 401/403. */
export async function guard(
    minRole: Role,
): Promise<{ res: NextResponse } | Extract<AuthzResult, { ok: true }>> {
    const result = await authorize(minRole)
    if (!result.ok) {
        return { res: error(result.status === 401 ? 'unauthorized' : 'forbidden', result.status) }
    }
    return result
}

/** Successful project-scoped authorization (planning §9.1). */
export interface ProjectAuth {
    session: SessionPayload
    /** Global role (`owner` | `guest`). */
    role: Role
    /** Effective project role; the global owner is treated as `devops`. */
    projectRole: ProjectRole
    isOwner: boolean
    projectId: string
}

/**
 * Guard a route by project membership + minimum PROJECT role (planning §9.1):
 * require any session → the global `owner` short-circuits (treated as devops on
 * every project) → otherwise the project must exist (404) and the caller must hold
 * a membership at/above `minProjectRole` (403). Returns the project auth context.
 */
export async function guardProject(
    projectId: string,
    minProjectRole: ProjectRole,
): Promise<{ res: NextResponse } | ProjectAuth> {
    const session = await getSession()
    if (!session) return { res: error('unauthorized', 401) }

    const { getRole } = await import('@/server/services/auth')
    const role = getRole(session.sub) ?? 'guest'

    if (role === 'owner') {
        // Owner outranks any project role everywhere — but the project must exist.
        if (!projectRepo.byId(projectId)) return { res: error('not found', 404) }
        return { session, role, projectRole: 'devops', isOwner: true, projectId }
    }

    if (!projectRepo.byId(projectId)) return { res: error('not found', 404) }
    const membership = memberRepo.getMembership(projectId, session.sub)
    if (!membership) return { res: error('forbidden', 403) }
    if (PROJECT_ROLE_RANK[membership.projectRole] < PROJECT_ROLE_RANK[minProjectRole]) {
        return { res: error('forbidden', 403) }
    }
    return { session, role, projectRole: membership.projectRole, isOwner: false, projectId }
}

/**
 * Record who did what — best-effort (an audit failure never blocks the mutation).
 * Accepts any guard result carrying a `session`.
 */
export function audit(
    auth: { session: SessionPayload },
    action: string,
    projectId?: string | null,
    detail?: string | null,
): void {
    try {
        auditRepo.append({
            githubId: auth.session.sub,
            login: auth.session.login,
            action,
            projectId,
            detail,
        })
    } catch {
        /* best-effort */
    }
}

/** Audit entry for non-user actors (scheduler / agent fetch). */
export function auditSystem(action: string, projectId?: string | null, detail?: string | null): void {
    try {
        auditRepo.append({ githubId: null, login: 'system', action, projectId, detail })
    } catch {
        /* best-effort */
    }
}
