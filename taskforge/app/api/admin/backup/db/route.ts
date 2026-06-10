// E3 — online SQLite backup: `VACUUM INTO` a temp file, stream it as a download.

import { promises as fs } from 'node:fs'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import path from 'node:path'
import os from 'node:os'
import { guard, error, audit } from '@/server/web/http'
import { prep } from '@/server/data/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res

    const tmp = path.join(os.tmpdir(), `taskforge-backup-${Date.now()}.db`)
    try {
        // VACUUM INTO performs a consistent online copy under WAL.
        prep(`VACUUM INTO ?`).run(tmp)
    } catch (e: any) {
        return error(`backup failed: ${e?.message ?? e}`, 500)
    }

    const stat = await fs.stat(tmp)
    const nodeStream = createReadStream(tmp)
    nodeStream.on('close', () => void fs.unlink(tmp).catch(() => {}))
    audit(auth, 'backup.db', null, `${stat.size} bytes`)

    const stamp = new Date().toISOString().slice(0, 10)
    return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(stat.size),
            'Content-Disposition': `attachment; filename="taskforge-${stamp}.db"`,
        },
    })
}
