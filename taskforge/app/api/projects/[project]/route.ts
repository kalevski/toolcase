import { guard, json, error, audit } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { deleteProject, ProjectLockedError } from '@/server/services/provision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    // SEC-3 — project deletion irrecoverably destroys the workspace + DB rows
    // (backups of the same data are admin-gated), so require admin.
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        await deleteProject(params.project)
        audit(auth, 'project.delete', params.project)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof ProjectLockedError) return error('run in progress', 409)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
