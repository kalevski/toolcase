import { guardProject, json, error, audit } from '@/server/web/http'
import { cloneEnvironment, EnvironmentExistsError, EnvironmentNotFoundError } from '@/server/services/clones'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; envId: string }> }

// Deep-copy an environment (devops+). Planning §8.6.
export async function POST(req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { newName?: string }
    const newName = (body.newName ?? '').trim()
    if (!newName) return error('newName required', 400)
    try {
        const env = cloneEnvironment(id, envId, newName)
        audit(auth, 'environment.clone', id, `${envId}->${env.id}`)
        return json(env, 201)
    } catch (e) {
        if (e instanceof EnvironmentNotFoundError) return error('not found', 404)
        if (e instanceof EnvironmentExistsError) return error('environment name already exists', 409)
        throw e
    }
}
