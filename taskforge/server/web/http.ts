// Small helpers shared by route handlers.

import 'server-only'
import { NextResponse } from 'next/server'
import { authorize, type AuthzResult } from '@/server/services/auth'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { UnsafePathError, ReorderError } from '@/server/infrastructure/fs-workspace'
import { GitError } from '@/server/infrastructure/git'
import { GithubError } from '@/server/infrastructure/github'
import { InvalidCronError } from '@/server/domain/cron'
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
export async function guard(
    minRole: Role,
): Promise<{ res: NextResponse } | (Extract<AuthzResult, { ok: true }>)> {
    const result = await authorize(minRole)
    if (!result.ok) {
        return { res: error(result.status === 401 ? 'unauthorized' : 'forbidden', result.status) }
    }
    return result
}

/**
 * D3 — record who did what. `auth` is the successful guard result; best-effort
 * (an audit failure never blocks the mutation it describes).
 */
export function audit(
    auth: Extract<AuthzResult, { ok: true }>,
    action: string,
    project?: string | null,
    detail?: string | null,
): void {
    try {
        auditRepo.append({
            githubId: auth.session.sub,
            login: auth.session.login,
            action,
            project,
            detail,
        })
    } catch {
        /* best-effort */
    }
}

/** D3 — audit entry for non-user actors (scheduler etc.). */
export function auditSystem(action: string, project?: string | null, detail?: string | null): void {
    try {
        auditRepo.append({ githubId: null, login: 'system', action, project, detail })
    } catch {
        /* best-effort */
    }
}

// ── shared error → HTTP mapping ───────────────────────────────────────────────
//
// Canonical status for every cross-cutting typed error, so routes stop
// hand-repeating `instanceof` chains (the same UnsafePathError line existed in
// 43 routes). Route usage:
//
//     } catch (e) {
//         const res = errorFrom(e)
//         if (res) return res
//         throw e                    // unknown → framework 500
//     }
//
// A route with genuinely different semantics (custom body, extra hint) checks
// its special case BEFORE calling errorFrom. Errors from heavyweight modules
// (execution-manager's LockHeldError/DirtyTreeError) are deliberately NOT here:
// only two routes map them and both need custom bodies — and importing the
// engine from this file would pull it into every route's module graph.
// Service-specific errors (accounts, roles, provision, …) also stay in their
// owning route/service to keep this file's import surface small; the pattern
// for those is a per-service `httpErrorFor` (see site-settings.ts).

export function mapError(err: unknown): { status: number; message: string } | null {
    if (err instanceof UnsafePathError) return { status: 400, message: 'invalid name' }
    if (err instanceof ReorderError) return { status: 409, message: err.message || 'reorder conflict' }
    if (err instanceof GitError) return { status: 400, message: err.stderr || err.message }
    if (err instanceof GithubError) return { status: 502, message: err.message }
    if (err instanceof InvalidCronError) return { status: 400, message: `invalid cron: ${err.message}` }
    return null
}

/** Map a known error to a ready-to-return response, or null to re-throw. */
export function errorFrom(err: unknown): NextResponse | null {
    const mapped = mapError(err)
    return mapped ? error(mapped.message, mapped.status) : null
}
