// PATCH — change a user's role (admin). Setting `guest` revokes access; the
// last-admin-demotion guard lives in the service (spec §6.5, §9).

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import { setRole, UserError } from '@/server/services/users'
import type { Role } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    const githubId = Number(id)
    if (!Number.isInteger(githubId)) return json({ error: 'invalid user id' }, 422)
    const body = await req.json().catch(() => ({}))
    try {
        const user = setRole(githubId, body?.role as Role)
        audit(auth, 'user.role', `${user.login} → ${user.role}`)
        return json({ user })
    } catch (err) {
        if (err instanceof UserError) return json({ error: err.message }, err.status)
        throw err
    }
}
