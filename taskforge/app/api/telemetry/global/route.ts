// D1 — global per-day cost across all projects (Dashboard card).

import { guard, json } from '@/server/web/http'
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const days = Number(new URL(req.url).searchParams.get('days')) || 30
    return json(telemetryRepo.globalCostPerDay(Math.min(Math.max(days, 1), 365)))
}
