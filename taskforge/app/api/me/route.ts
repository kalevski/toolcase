import { guard, json } from '@/server/web/http'
import { getUser } from '@/server/services/roles'
import type { MeResponse } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('guest')
    if ('res' in auth) return auth.res

    const user = await getUser(auth.session.sub)
    const me: MeResponse = {
        githubId: auth.session.sub,
        login: user?.login ?? auth.session.login,
        name: user?.name ?? auth.session.login,
        avatarUrl: user?.avatarUrl,
        role: auth.role,
    }
    return json(me)
}
