import { guard, json, error, audit } from '@/server/web/http'
import { setGlobalRole, LastOwnerError, UserNotFoundError } from '@/server/services/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ githubId: string }> }

// PATCH /api/users/:githubId — owner promotes/demotes a global role. Refuses to
// demote the last owner (gap-9 → 409).
export async function PATCH(req: Request, { params }: Ctx) {
    const { githubId } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { role?: string }
    if (body.role !== 'owner' && body.role !== 'guest') return error('role must be owner or guest', 400)
    try {
        const user = setGlobalRole(Number(githubId), body.role)
        audit(auth, 'user.role', null, `${githubId}:${body.role}`)
        return json(user)
    } catch (e) {
        if (e instanceof UserNotFoundError) return error('not found', 404)
        if (e instanceof LastOwnerError) return error('cannot demote the last owner', 409)
        throw e
    }
}
