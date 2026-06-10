import { guard, error } from '@/server/web/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Superseded by the streaming agent sessions (§3) — POST agents/task-creator/start. */
export async function POST(_req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return error('gone — use POST /api/projects/[project]/agents/task-creator/start', 410)
}
