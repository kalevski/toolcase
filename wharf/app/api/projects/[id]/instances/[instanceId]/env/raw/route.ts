import { guardProject, json, error } from '@/server/web/http'
import { listInstanceScope, ScopeNotFoundError } from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; instanceId: string }> }

// Instance-scope override rows, for editing (not resolved/merged).
export async function GET(_req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        return json(listInstanceScope(id, instanceId))
    } catch (e) {
        if (e instanceof ScopeNotFoundError) return error('instance not found', 404)
        throw e
    }
}
