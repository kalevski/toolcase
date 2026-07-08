// DELETE — remove a model blob (admin); refused while in use / downloading.

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import { deleteModel, ModelStoreError } from '@/server/services/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    const { name } = await ctx.params
    try {
        await deleteModel(name)
        audit(auth, 'model.delete', name)
        return json({ ok: true })
    } catch (err) {
        if (err instanceof ModelStoreError) return json({ error: err.message }, err.status)
        throw err
    }
}
