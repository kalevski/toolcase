import { guard, error } from '@/server/web/http'
import { getBackupBlob, BackupNotFoundError } from '@/server/services/backups'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Owner-only download of the encrypted backup blob (decrypt out-of-band to restore).
export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    try {
        const { backup, bytes } = getBackupBlob(id)
        return new Response(new Uint8Array(bytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${backup.path.split('/').pop() ?? id}"`,
                'Content-Length': String(bytes.length),
            },
        })
    } catch (e) {
        if (e instanceof BackupNotFoundError) return error('not found', 404)
        throw e
    }
}
