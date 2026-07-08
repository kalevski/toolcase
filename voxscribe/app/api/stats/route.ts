// GET — dashboard aggregates, scoped to the actor (spec §8).

import { guard, json } from '@/server/web/http'
import { stats } from '@/server/services/stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(stats({ githubId: auth.session.sub, login: auth.session.login, role: auth.role }))
}
