// E3 — project export: tarball of tasks/ + knowledge/ + notes/ + CLAUDE.md
// (excludes repo/, which is re-clonable). Spawns the system `tar` (in the image)
// and streams its stdout.

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { Readable } from 'node:stream'
import { guard, error, audit, errorFrom } from '@/server/web/http'
import { projectExists, projectPath } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const root = projectPath(params.project)

        // Only include the operational dirs that exist (tar errors on missing args).
        const candidates = ['tasks', 'knowledge', 'notes', 'CLAUDE.md']
        const include: string[] = []
        for (const c of candidates) {
            try {
                await fs.access(`${root}/${c}`)
                include.push(c)
            } catch {
                /* absent */
            }
        }
        if (!include.length) return error('nothing to export', 404)

        const tar = spawn('tar', ['-czf', '-', '-C', root, ...include], {
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        audit(auth, 'backup.project', params.project, include.join(','))

        const stamp = new Date().toISOString().slice(0, 10)
        return new Response(Readable.toWeb(tar.stdout) as ReadableStream, {
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="${params.project}-${stamp}.tar.gz"`,
            },
        })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
