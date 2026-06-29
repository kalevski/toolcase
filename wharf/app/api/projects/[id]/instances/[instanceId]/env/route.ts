import { guardProject, json, error } from '@/server/web/http'
import { resolveInstance, ScopeNotFoundError, InterpolationCycleError } from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; instanceId: string }> }

// Resolved environment for an instance (cascade + masking + templating + pending).
// Real secret values only for devops/owner; developers get `<hidden:name>`.
export async function GET(_req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const canReadSecrets = auth.isOwner || auth.projectRole === 'devops'
    try {
        return json(resolveInstance(id, instanceId, canReadSecrets))
    } catch (e) {
        if (e instanceof ScopeNotFoundError) return error('instance not found', 404)
        if (e instanceof InterpolationCycleError) return error(`template cycle at ${e.key}`, 422)
        throw e
    }
}
