import { guard, guardProject, json, error, audit } from '@/server/web/http'
import {
    deleteProject,
    getProject,
    renameProject,
    ProjectNotFoundError,
} from '@/server/services/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// GET — any project member (developer+) may read the project + their effective role.
export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const project = getProject(id)
    if (!project) return error('not found', 404)
    return json({
        project,
        effectiveRole: auth.isOwner ? 'owner' : auth.projectRole,
        isOwner: auth.isOwner,
    })
}

// PATCH — owner only (rename).
export async function PATCH(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)
    try {
        const project = renameProject(id, name)
        audit(auth, 'project.rename', id, name)
        return json(project)
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('not found', 404)
        throw e
    }
}

// DELETE — owner only (cascades).
export async function DELETE(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    try {
        deleteProject(id)
        audit(auth, 'project.delete', id)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('not found', 404)
        throw e
    }
}
