import { guardProject, json, error, audit } from '@/server/web/http'
import {
    updateSecret,
    deleteSecret,
    SecretNotFoundError,
    SecretReferencedError,
} from '@/server/services/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; secretId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, secretId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { value?: string; description?: string }
    if (body.value !== undefined && (typeof body.value !== 'string' || body.value.length === 0)) {
        return error('value required', 400)
    }
    try {
        const meta = updateSecret(id, secretId, { value: body.value, description: body.description })
        audit(auth, 'secret.update', id, meta.key)
        return json(meta)
    } catch (e) {
        if (e instanceof SecretNotFoundError) return error('not found', 404)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, secretId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    try {
        deleteSecret(id, secretId)
        audit(auth, 'secret.delete', id, secretId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof SecretNotFoundError) return error('not found', 404)
        if (e instanceof SecretReferencedError) return error('secret is referenced by env vars', 409)
        throw e
    }
}
