import { guardProject, json, error, audit } from '@/server/web/http'
import {
    updateFlag,
    deleteFlag,
    FlagNotFoundError,
    ValueTypeError,
} from '@/server/services/flags'
import type { FlagType } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; flagId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, flagId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        description?: string
        type?: FlagType
    }
    try {
        const flag = updateFlag(id, flagId, body)
        audit(auth, 'flag.update', id, flag.key)
        return json(flag)
    } catch (e) {
        if (e instanceof FlagNotFoundError) return error('not found', 404)
        if (e instanceof ValueTypeError) return error(e.message || 'invalid type', 400)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, flagId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        deleteFlag(id, flagId)
        audit(auth, 'flag.delete', id, flagId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof FlagNotFoundError) return error('not found', 404)
        throw e
    }
}
