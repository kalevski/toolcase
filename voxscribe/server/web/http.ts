// Small helpers shared by route handlers (taskforge-style seam, spec §6).

import 'server-only'
import { NextResponse } from 'next/server'
import { authorize, type AuthzResult } from '@/server/services/auth'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import type { Role } from '@/server/domain/types'

export function json(data: unknown, status = 200): NextResponse {
    return NextResponse.json(data, { status })
}

export function error(message: string, status: number): NextResponse {
    return NextResponse.json({ error: message }, { status })
}

/**
 * Guard a route by minimum role. Returns the authorized result on success, or a
 * ready-to-return NextResponse (401/403) on failure.
 */
export async function guard(minRole: Role): Promise<{ res: NextResponse } | Extract<AuthzResult, { ok: true }>> {
    const result = await authorize(minRole)
    if (!result.ok) {
        return { res: error(result.status === 401 ? 'unauthorized' : 'forbidden', result.status) }
    }
    return result
}

/**
 * Record who did what. `auth` is the successful guard result; best-effort
 * (an audit failure never blocks the mutation it describes).
 */
export function audit(auth: Extract<AuthzResult, { ok: true }>, action: string, detail?: string | null): void {
    try {
        auditRepo.append({
            githubId: auth.session.sub,
            login: auth.session.login,
            action,
            detail,
        })
    } catch {
        /* best-effort */
    }
}

/** Audit entry for non-user actors (worker, sweep). */
export function auditSystem(action: string, detail?: string | null): void {
    try {
        auditRepo.append({ githubId: null, login: 'system', action, detail })
    } catch {
        /* best-effort */
    }
}
