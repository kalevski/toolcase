import { guard, json, error, audit } from '@/server/web/http'
import { setRole, LastAdminError, UnknownUserError } from '@/server/services/roles'
import type { Role } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = ['admin', 'standard', 'guest']

export async function PUT(req: Request, ctx: { params: Promise<{ githubId: string }> }) {
    const params = await ctx.params
    const auth = await guard('admin')
    if ('res' in auth) return auth.res

    const githubId = Number(params.githubId)
    if (!Number.isFinite(githubId)) return error('invalid user id', 400)

    const body = (await req.json().catch(() => ({}))) as { role?: Role }
    if (!body.role || !ROLES.includes(body.role)) return error('invalid role', 400)

    try {
        const user = await setRole(githubId, body.role)
        audit(auth, 'user.role', null, `${githubId} -> ${body.role}`)
        return json(user)
    } catch (e) {
        if (e instanceof LastAdminError) return error('cannot demote the last admin', 409)
        if (e instanceof UnknownUserError) return error('user not found', 404)
        throw e
    }
}
