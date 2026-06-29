// Public liveness probe (Docker HEALTHCHECK). No auth, no detail.

import { json } from '@/server/web/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    return json({ ok: true })
}
