import { guardProject, json, error, audit } from '@/server/web/http'
import {
    createEnvVar,
    EnvVarExistsError,
    InvalidKeyError,
    ScopeNotFoundError,
    SecretNotFoundError,
    type EnvVarInput,
} from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Create an env var at the environment baseline or an instance override (developer+).
export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as Partial<EnvVarInput>
    if (!body.environmentId || !body.key || (body.source !== 'literal' && body.source !== 'secret_ref')) {
        return error('environmentId, key and source (literal|secret_ref) required', 400)
    }
    try {
        const created = createEnvVar(id, body as EnvVarInput)
        audit(auth, 'env.create', id, `${body.key}`)
        return json(created, 201)
    } catch (e) {
        if (e instanceof InvalidKeyError) return error('invalid key (use A-Z, 0-9, _)', 400)
        if (e instanceof ScopeNotFoundError) return error('scope not found', 404)
        if (e instanceof SecretNotFoundError) return error('secret not found', 422)
        if (e instanceof EnvVarExistsError) return error('key already exists in this scope', 409)
        throw e
    }
}
