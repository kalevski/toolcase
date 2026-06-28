import { guard, json, error, audit } from '@/server/web/http'
import { removeMember, updateMemberRole, UserNotFoundError } from '@/server/services/members'
import { isProjectRole } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; githubId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, githubId } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { role?: string }
    if (!isProjectRole(body.role)) return error('role must be developer or devops', 400)
    try {
        updateMemberRole(id, Number(githubId), body.role)
        audit(auth, 'member.role', id, `${githubId}:${body.role}`)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof UserNotFoundError) return error('not a member', 404)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, githubId } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    removeMember(id, Number(githubId))
    audit(auth, 'member.remove', id, githubId)
    return json({ ok: true })
}
