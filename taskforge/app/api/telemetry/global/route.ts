// D1 — global per-day cost across all projects (Dashboard card).

import { guard, json } from '@/server/web/http'
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365)
    // `?by=project` returns the per-project cost/runs trend grid (dashboard row
    // sparklines); the default is the all-projects cost-per-day series.
    if (url.searchParams.get('by') === 'project') {
        return json(telemetryRepo.costPerDayByProject(days))
    }
    return json(telemetryRepo.globalCostPerDay(days))
}
