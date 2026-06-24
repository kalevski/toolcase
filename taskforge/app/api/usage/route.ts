import { guard, json, error } from '@/server/web/http'
import { readUsageCache, refreshUsage, UsageError } from '@/server/services/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Serve the cached `/usage` snapshot. Never spawns the agent. `?account=<alias>`
 * selects a registry identity's cache; omitted = the ambient host login.
 */
export async function GET(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const account = new URL(req.url).searchParams.get('account') || null
    return json({ usage: await readUsageCache(account) })
}

/**
 * Run `/usage` via the agent, cache it, and return the fresh snapshot. An
 * optional `{ account }` body runs `/usage` under that registry identity.
 */
export async function POST(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { account?: string }
    const account = body.account?.trim() || null
    try {
        const usage = await refreshUsage(Date.now(), account)
        return json({ usage })
    } catch (err) {
        const message = err instanceof UsageError ? err.message : 'Failed to fetch usage'
        return error(message, 502)
    }
}
