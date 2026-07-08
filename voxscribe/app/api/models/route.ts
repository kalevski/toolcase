// GET — allowed models + local presence + in-flight download pct (spec §8).
// Standard-guarded: the upload form needs it; mutations stay admin-only.

import { guard, json } from '@/server/web/http'
import { listModels, resolveModelsForJob } from '@/server/services/models'
import { config } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const models = await listModels()
    return json({
        models,
        available: await resolveModelsForJob(),
        defaultModel: config.defaultModel,
    })
}
