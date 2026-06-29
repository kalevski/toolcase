import { guardProject, json, error, audit } from '@/server/web/http'
import { mintKey, revokeKey, InstanceNotFoundError } from '@/server/services/instance-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; instanceId: string }> }

// Mint / rotate the instance fetch key (devops+). Returns the raw secret ONCE.
// Rotation overwrites the old key immediately (decision #8, gap-10).
export async function POST(req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { expiresAt?: string | null }
    try {
        const secret = mintKey(id, instanceId, body.expiresAt ?? null)
        audit(auth, 'instance.key.mint', id, instanceId)
        return json({ secret })
    } catch (e) {
        if (e instanceof InstanceNotFoundError) return error('not found', 404)
        throw e
    }
}

// Revoke the instance fetch key (devops+).
export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, instanceId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    try {
        revokeKey(id, instanceId)
        audit(auth, 'instance.key.revoke', id, instanceId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof InstanceNotFoundError) return error('not found', 404)
        throw e
    }
}
