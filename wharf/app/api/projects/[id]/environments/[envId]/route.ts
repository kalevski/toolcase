import { guardProject, json, error, audit } from '@/server/web/http'
import {
    updateEnvironment,
    deleteEnvironment,
    EnvironmentExistsError,
    EnvironmentNotFoundError,
} from '@/server/services/environments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; envId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        name?: string
        strictRequired?: boolean
        sortOrder?: number
    }
    try {
        const env = updateEnvironment(id, envId, body)
        audit(auth, 'environment.update', id, envId)
        return json(env)
    } catch (e) {
        if (e instanceof EnvironmentNotFoundError) return error('not found', 404)
        if (e instanceof EnvironmentExistsError) return error('environment name already exists', 409)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    try {
        deleteEnvironment(id, envId)
        audit(auth, 'environment.delete', id, envId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof EnvironmentNotFoundError) return error('not found', 404)
        throw e
    }
}
