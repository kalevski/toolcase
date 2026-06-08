import { guard, json, error } from '@/server/http'
import { readUsageCache, refreshUsage, UsageError } from '@/server/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Serve the cached `/usage` snapshot. Never spawns the agent. */
export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json({ usage: await readUsageCache() })
}

/** Run `/usage` via the agent, cache it, and return the fresh snapshot. */
export async function POST() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        const usage = await refreshUsage(Date.now())
        return json({ usage })
    } catch (err) {
        const message = err instanceof UsageError ? err.message : 'Failed to fetch usage'
        return error(message, 502)
    }
}
