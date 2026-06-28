import { guardProject, json, error, audit } from '@/server/web/http'
import {
    createInstance,
    listInstances,
    EnvironmentNotFoundError,
    InstanceExistsError,
} from '@/server/services/instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; envId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        return json(listInstances(id, envId))
    } catch (e) {
        if (e instanceof EnvironmentNotFoundError) return error('environment not found', 404)
        throw e
    }
}

export async function POST(req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)
    try {
        const inst = createInstance(id, envId, name)
        audit(auth, 'instance.create', id, `${envId}/${name}`)
        return json(inst, 201)
    } catch (e) {
        if (e instanceof EnvironmentNotFoundError) return error('environment not found', 404)
        if (e instanceof InstanceExistsError) return error('instance name already exists', 409)
        throw e
    }
}
