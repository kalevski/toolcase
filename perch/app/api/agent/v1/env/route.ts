// GET /api/agent/v1/env[?format=dotenv|json] → resolved env vars — instance-key
// authenticated, ETag/304 (move_wharf_to_perch.md §9).

import { NextResponse } from 'next/server'
import { beginAgentFetch } from '@/server/services/agent-fetch'
import { stringify as dotenvStringify } from '@/server/domain/env-file'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const result = beginAgentFetch(req, '/api/agent/v1/env')
    if (!result.ok) return result.response
    const { env, version } = result.snapshot

    if (new URL(req.url).searchParams.get('format') === 'dotenv') {
        const text = dotenvStringify(Object.entries(env).map(([key, value]) => ({ key, value })))
        return new NextResponse(text, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', ETag: version },
        })
    }
    return NextResponse.json(env, { headers: { ETag: version } })
}
