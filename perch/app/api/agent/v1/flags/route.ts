// GET /api/agent/v1/flags → { key: { enabled } } — instance-key authenticated,
// ETag/304 (move_wharf_to_perch.md §9).

import { NextResponse } from 'next/server'
import { beginAgentFetch } from '@/server/services/agent-fetch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const result = beginAgentFetch(req, '/api/agent/v1/flags')
    if (!result.ok) return result.response
    const { flags, version } = result.snapshot
    return NextResponse.json(flags, { headers: { ETag: version } })
}
