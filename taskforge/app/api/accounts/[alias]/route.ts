// Multi-account management — remove a single Claude identity (registry row +
// config dir). Admin-only; emits an audit record.

import { guard, json, error, audit } from '@/server/web/http'
import { removeAccount } from '@/server/services/accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, ctx: { params: Promise<{ alias: string }> }) {
    const params = await ctx.params
    const auth = await guard('admin')
    if ('res' in auth) return auth.res

    const removed = await removeAccount(params.alias)
    if (!removed) return error('account not found', 404)

    audit(auth, 'account.delete', null, params.alias)
    return json({ ok: true })
}
