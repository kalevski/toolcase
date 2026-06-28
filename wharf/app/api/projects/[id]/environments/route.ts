import { guardProject, json, error, audit } from '@/server/web/http'
import {
    createEnvironment,
    listEnvironments,
    EnvironmentExistsError,
    ProjectNotFoundError,
} from '@/server/services/environments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    return json(listEnvironments(id))
}

export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)
    try {
        const env = createEnvironment(id, name)
        audit(auth, 'environment.create', id, name)
        return json(env, 201)
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('project not found', 404)
        if (e instanceof EnvironmentExistsError) return error('environment name already exists', 409)
        throw e
    }
}
