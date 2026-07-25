// GET /api/db-servers/{id}/databases/{name}/export — download a database as a
// plain SQL dump (`?data=0` for structure only). The `pg_dump`/`mysqldump` child
// streams straight into the response body, so a multi-GB database costs a pipe
// rather than quaykeeper's heap.
//
// Maintainer+, same gate as the rest of /api/db-servers/**. Identifier
// validation, existence check, probe bookkeeping, and audit live in
// `services/db-manage.ts`; a failing tool maps to 502 with the engine's message,
// a tool that isn't installed on the host to 500 `dump_tool_missing`.

import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; name: string }> }

export async function GET(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'databases')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id, name } = await ctx.params
    const includeData = new URL(req.url).searchParams.get('data') !== '0'
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const { fileName, stream } = await dbManage.exportDatabase(actor, id, decodeURIComponent(name), {
            includeData,
        })
        return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
            headers: {
                'content-type': 'application/sql; charset=utf-8',
                // The name is built from a validated database name and a slugged
                // server name, so it needs no further quoting.
                'content-disposition': `attachment; filename="${fileName}"`,
                'cache-control': 'no-store',
            },
        })
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
