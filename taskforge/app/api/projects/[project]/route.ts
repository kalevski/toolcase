import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { deleteProject, ProjectLockedError } from '@/server/services/provision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        await deleteProject(params.project)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof ProjectLockedError) return error('run in progress', 409)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
