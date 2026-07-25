// POST /api/db-servers/{id}/databases/{name}/import — restore a previously
// exported SQL dump into `{name}` on this server. The request body IS the .sql
// file (no multipart wrapper): it streams into the `psql`/`mysql` child's stdin,
// so the upload never lands on disk or in quaykeeper's heap.
//
// `?create=1` creates the target database first — the usual shape when moving a
// database to a server that has never held it. Without it, an unknown target is
// a 404 rather than a silent create.
//
// Maintainer+, same gate as the rest of /api/db-servers/**. The restore aborts on
// the first SQL error (postgres additionally rolls the whole thing back), so a
// failed import never leaves a half-populated database behind.

import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; name: string }> }

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'databases')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    if (!req.body) return NextResponse.json({ error: 'empty_dump' }, { status: 400 })

    const { id, name } = await ctx.params
    const create = new URL(req.url).searchParams.get('create') === '1'
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const result = await dbManage.importDatabase(
            actor,
            id,
            decodeURIComponent(name),
            Readable.fromWeb(req.body as import('node:stream/web').ReadableStream<Uint8Array>),
            { create },
        )
        return NextResponse.json(result)
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
