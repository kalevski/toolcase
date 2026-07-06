// D4 — admin diagnostics: CLI/git versions, disk, DB, engine states, config.

import { guard, json } from '@/server/web/http'
import { healthDetails } from '@/server/services/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    return json(await healthDetails())
}
