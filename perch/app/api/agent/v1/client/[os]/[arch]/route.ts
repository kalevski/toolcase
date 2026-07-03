// GET /api/agent/v1/client/{os}/{arch} — the static perch-client binary
// (unauthenticated, like wharf; move_wharf_to_perch.md §9). Served from
// `config.clientDir`, populated by the Dockerfile's `client` build stage.

import { NextResponse } from 'next/server'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import path from 'node:path'
import { config } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ os: string; arch: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const { os, arch } = await ctx.params
    // Allowlist os/arch to prevent path traversal.
    if (!/^[a-z0-9]+$/.test(os) || !/^[a-z0-9]+$/.test(arch)) {
        return NextResponse.json({ error: 'bad_target' }, { status: 400 })
    }
    const file = path.join(config.clientDir, os, arch, 'perch-client')
    if (!existsSync(file)) {
        return NextResponse.json({ error: 'binary not built for this target' }, { status: 404 })
    }
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream
    return new NextResponse(body, {
        status: 200,
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(statSync(file).size),
        },
    })
}
