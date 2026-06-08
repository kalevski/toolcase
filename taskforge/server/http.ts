// Small helpers shared by route handlers.

import 'server-only'
import { NextResponse } from 'next/server'
import { authorize, type AuthzResult } from './auth'
import type { Role } from './types'

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
