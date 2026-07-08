// GET — user list (admin), spec §8.

import { guard, json } from '@/server/web/http'
import { listUsers } from '@/server/services/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    return json({ users: listUsers() })
}
