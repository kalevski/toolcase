import { guardProject, json, error, audit } from '@/server/web/http'
import {
    generateSecret_,
    SecretExistsError,
    ProjectNotFoundError,
    InvalidKeyError,
} from '@/server/services/secrets'
import type { SecretGenKind } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const KINDS: ReadonlySet<string> = new Set(['password', 'token', 'hex', 'base64'])

// Devops-only. Generates entropy server-side; responds with keys-only metadata —
// the generated value is NEVER returned (planning §8.2). To view it, the caller
// uses the audited reveal endpoint afterwards.
export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        key?: string
        kind?: string
        length?: number
        charset?: string
    }
    const key = (body.key ?? '').trim()
    if (!key) return error('key required', 400)
    if (!body.kind || !KINDS.has(body.kind)) return error('invalid kind', 400)
    const length = Number(body.length)
    if (!Number.isInteger(length) || length <= 0) return error('invalid length', 400)
    // Clamp: a huge length would allocate ~length bytes of entropy synchronously,
    // blocking the event loop / risking OOM (wharf S3).
    if (length > 4096) return error('length too large', 400)
    // A 0/1-char charset can't produce a secret (% 0 → NaN, or all-same char); a
    // non-string charset is invalid too (wharf I3). undefined = use the default.
    if (body.charset !== undefined) {
        if (typeof body.charset !== 'string' || body.charset.length < 2) {
            return error('charset must be at least 2 characters', 400)
        }
    }
    try {
        const meta = generateSecret_(
            id,
            { key, kind: body.kind as SecretGenKind, length, charset: body.charset },
            auth.session.sub,
        )
        audit(auth, 'secret.generate', id, meta.key)
        return json(meta, 201)
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('project not found', 404)
        if (e instanceof InvalidKeyError) return error('invalid key', 400)
        if (e instanceof SecretExistsError) return error('secret key already exists', 409)
        throw e
    }
}
