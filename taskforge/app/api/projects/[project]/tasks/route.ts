import { guard, json, error } from '@/server/web/http'
import { getTasks } from '@/server/services/projects'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(await getTasks(params.project))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
