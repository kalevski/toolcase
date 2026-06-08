import { guard, json } from '@/server/http'
import { getRepoSummaries } from '@/server/repos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(await getRepoSummaries())
}
