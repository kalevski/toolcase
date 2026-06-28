import { guardProject, json, error } from '@/server/web/http'
import { listEnvironmentScope, ScopeNotFoundError } from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; envId: string }> }

// Environment-scope baseline rows, for editing.
export async function GET(_req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        return json(listEnvironmentScope(id, envId))
    } catch (e) {
        if (e instanceof ScopeNotFoundError) return error('environment not found', 404)
        throw e
    }
}
