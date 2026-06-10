// C3 — workspace search over tasks / knowledge / notes (FTS5).

import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import * as searchRepo from '@/server/data/repositories/search-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
        if (!q) return json({ available: searchRepo.searchAvailable(), hits: [] })
        return json({
            available: searchRepo.searchAvailable(),
            hits: searchRepo.search(params.project, q),
        })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
