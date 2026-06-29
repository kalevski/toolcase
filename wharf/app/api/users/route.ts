import { guard, json } from '@/server/web/http'
import { listUsers } from '@/server/services/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/users — owner-only roster (member picker + admin moderation).
export async function GET() {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    return json(listUsers())
}
