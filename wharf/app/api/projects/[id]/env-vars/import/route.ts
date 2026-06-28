import { guardProject, json, error, audit } from '@/server/web/http'
import { importEnvVars, ScopeNotFoundError } from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Bulk .env import into one scope (developer+). Planning §8.1.
export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        environmentId?: string
        instanceId?: string | null
        text?: string
        onConflict?: 'skip' | 'overwrite'
        promote?: string[]
    }
    if (!body.environmentId || typeof body.text !== 'string') {
        return error('environmentId and text required', 400)
    }
    try {
        const result = importEnvVars(id, {
            environmentId: body.environmentId,
            instanceId: body.instanceId ?? null,
            text: body.text,
            onConflict: body.onConflict === 'overwrite' ? 'overwrite' : 'skip',
            promote: body.promote,
        })
        audit(auth, 'env.import', id, `${result.created}+${result.updated}`)
        return json(result)
    } catch (e) {
        if (e instanceof ScopeNotFoundError) return error('scope not found', 404)
        throw e
    }
}
