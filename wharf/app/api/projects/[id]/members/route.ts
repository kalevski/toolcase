import { guard, json, error, audit } from '@/server/web/http'
import { addMember, listMembers, MemberExistsError, ProjectNotFoundError, UserNotFoundError } from '@/server/services/members'
import { isProjectRole } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Member management is owner-only (planning §9 matrix).
export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    return json(listMembers(id))
}

export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { githubId?: number; role?: string }
    if (typeof body.githubId !== 'number') return error('githubId required', 400)
    if (!isProjectRole(body.role)) return error('role must be developer or devops', 400)
    try {
        const member = addMember(id, body.githubId, body.role, auth.session.sub)
        audit(auth, 'member.add', id, `${body.githubId}:${body.role}`)
        return json(member, 201)
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('project not found', 404)
        if (e instanceof UserNotFoundError) return error('user has not signed in yet', 422)
        if (e instanceof MemberExistsError) return error('already a member', 409)
        throw e
    }
}
