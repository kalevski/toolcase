import { guardProject, json, error, audit } from '@/server/web/http'
import {
    listFlagsWithValues,
    createFlag,
    FlagExistsError,
    ValueTypeError,
} from '@/server/services/flags'
import type { FlagType } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    return json(listFlagsWithValues(id))
}

export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        key?: string
        description?: string
        type?: FlagType
    }
    try {
        const flag = createFlag(id, {
            key: body.key ?? '',
            description: body.description,
            type: body.type,
        })
        audit(auth, 'flag.create', id, flag.key)
        return json(flag, 201)
    } catch (e) {
        if (e instanceof ValueTypeError) return error(e.message || 'invalid key', 400)
        if (e instanceof FlagExistsError) return error('flag key already exists', 409)
        throw e
    }
}
