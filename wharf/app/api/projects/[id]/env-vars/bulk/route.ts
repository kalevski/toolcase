import { guardProject, json, error, audit } from '@/server/web/http'
import { bulkEnvVars, BulkConflictError, ScopeNotFoundError, type BulkAction } from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Bulk delete / move / copy of env vars (developer+). Planning §8.4.
export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        action?: BulkAction
        ids?: string[]
        target?: { environmentId: string; instanceId?: string | null }
    }
    if (!body.action || !Array.isArray(body.ids) || body.ids.length === 0) {
        return error('action and ids required', 400)
    }
    try {
        const result = bulkEnvVars(id, body.action, body.ids, body.target)
        audit(auth, 'env.bulk', id, body.action)
        return json(result)
    } catch (e) {
        if (e instanceof BulkConflictError) return json({ error: 'scope conflict', keys: e.keys }, 409)
        if (e instanceof ScopeNotFoundError) return error('target scope not found', 404)
        throw e
    }
}
