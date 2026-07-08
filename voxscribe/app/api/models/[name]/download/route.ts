// POST — start a background model download (admin). Progress is polled via
// GET /api/models; concurrent download of the same model → 409 (spec §8).

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import { startDownload, ModelStoreError } from '@/server/services/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    const { name } = await ctx.params
    try {
        startDownload(name)
        audit(auth, 'model.download', name)
        return json({ ok: true }, 202)
    } catch (err) {
        if (err instanceof ModelStoreError) return json({ error: err.message }, err.status)
        throw err
    }
}
