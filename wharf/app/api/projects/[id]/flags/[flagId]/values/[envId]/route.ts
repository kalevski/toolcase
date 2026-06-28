import { guardProject, json, error, audit } from '@/server/web/http'
import { setValue, FlagNotFoundError, ValueTypeError } from '@/server/services/flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; flagId: string; envId: string }> }

export async function PUT(req: Request, { params }: Ctx) {
    const { id, flagId, envId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { enabled?: boolean; value?: unknown }
    try {
        const value = setValue(id, flagId, envId, { enabled: body.enabled, value: body.value })
        audit(auth, 'flag.value', id, `${flagId}/${envId}`)
        return json(value)
    } catch (e) {
        if (e instanceof FlagNotFoundError) return error('not found', 404)
        if (e instanceof ValueTypeError) return error(e.message || 'invalid value', 400)
        throw e
    }
}
