import { guardProject, json, error, audit } from '@/server/web/http'
import {
    renameInstance,
    deleteInstance,
    getInstanceDetail,
    InstanceExistsError,
    InstanceNotFoundError,
} from '@/server/services/instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; instanceId: string }> }

// Instance detail + the caller's effective role (instance detail page).
export async function GET(_req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const detail = getInstanceDetail(id, instanceId)
    if (!detail) return error('not found', 404)
    return json({ ...detail, effectiveRole: auth.isOwner ? 'owner' : auth.projectRole, isOwner: auth.isOwner })
}

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)
    try {
        const inst = renameInstance(id, instanceId, name)
        audit(auth, 'instance.update', id, instanceId)
        return json(inst)
    } catch (e) {
        if (e instanceof InstanceNotFoundError) return error('not found', 404)
        if (e instanceof InstanceExistsError) return error('instance name already exists', 409)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    try {
        deleteInstance(id, instanceId)
        audit(auth, 'instance.delete', id, instanceId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof InstanceNotFoundError) return error('not found', 404)
        throw e
    }
}
