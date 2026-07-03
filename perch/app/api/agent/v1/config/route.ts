// GET /api/agent/v1/config → { env, flags, version } — instance-key authenticated,
// ETag/304 (move_wharf_to_perch.md §9). No session, no cookies.

import { NextResponse } from 'next/server'
import { beginAgentFetch } from '@/server/services/agent-fetch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const result = beginAgentFetch(req, '/api/agent/v1/config')
    if (!result.ok) return result.response
    const { env, flags, version } = result.snapshot
    return NextResponse.json({ env, flags, version }, { headers: { ETag: version } })
}
