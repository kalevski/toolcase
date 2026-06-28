import { guardProject, json, error, audit } from '@/server/web/http'
import {
    listSecrets,
    createSecret,
    SecretExistsError,
    ProjectNotFoundError,
    InvalidKeyError,
} from '@/server/services/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Developers may list KEYS only — and even devops never get values from this list.
export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    return json(listSecrets(id))
}

export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        key?: string
        value?: string
        description?: string
    }
    const key = (body.key ?? '').trim()
    if (!key) return error('key required', 400)
    if (typeof body.value !== 'string' || body.value.length === 0) return error('value required', 400)
    try {
        const meta = createSecret(
            id,
            { key, value: body.value, description: body.description },
            auth.session.sub,
        )
        audit(auth, 'secret.create', id, meta.key)
        return json(meta, 201)
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('project not found', 404)
        if (e instanceof InvalidKeyError) return error('invalid key', 400)
        if (e instanceof SecretExistsError) return error('secret key already exists', 409)
        throw e
    }
}
