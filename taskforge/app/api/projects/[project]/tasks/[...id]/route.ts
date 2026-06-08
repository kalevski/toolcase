import { guard, json, error } from '@/server/http'
import { readTaskFile, parseTask, UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        const content = await readTaskFile(params.project, id)
        const parsed = parseTask(content, id)
        return json({ id, content, ...parsed })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('task not found', 404)
    }
}
