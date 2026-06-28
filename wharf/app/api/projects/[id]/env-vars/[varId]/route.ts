import { guardProject, json, error, audit } from '@/server/web/http'
import {
    updateEnvVar,
    deleteEnvVar,
    EnvVarNotFoundError,
    SecretNotFoundError,
    type EnvVarPatch,
} from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; varId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, varId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as EnvVarPatch
    try {
        const updated = updateEnvVar(id, varId, body)
        audit(auth, 'env.update', id, updated.key)
        return json(updated)
    } catch (e) {
        if (e instanceof EnvVarNotFoundError) return error('not found', 404)
        if (e instanceof SecretNotFoundError) return error('secret not found', 422)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, varId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        deleteEnvVar(id, varId)
        audit(auth, 'env.delete', id, varId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof EnvVarNotFoundError) return error('not found', 404)
        throw e
    }
}
