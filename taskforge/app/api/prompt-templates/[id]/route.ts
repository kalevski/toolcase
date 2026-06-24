import { guard, json, error, audit } from '@/server/web/http'
import * as promptHistoryRepo from '@/server/data/repositories/prompt-history-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) return error('invalid id', 400)
    promptHistoryRepo.deleteTemplate(id)
    audit(auth, 'prompt-template.delete', null, String(id))
    return json({ ok: true })
}
