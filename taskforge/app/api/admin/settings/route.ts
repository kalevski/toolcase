// Admin instance-settings (`GET`/`PUT /api/admin/settings`) — read the full record
// and replace it. Admin-gated; the PUT is attributed to the acting admin in the audit
// log. Validation + persistence live in `services/site-settings.ts`.

import { guard, json, error, audit } from '@/server/web/http'
import { getSettings, updateSettings, httpErrorFor } from '@/server/services/site-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    return json(getSettings())
}

export async function PUT(req: Request) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return error('invalid_json', 400)
    }

    try {
        const next = updateSettings(body)
        audit(auth, 'settings.update', null, JSON.stringify(body))
        return json(next)
    } catch (err) {
        const { status, code } = httpErrorFor(err)
        return error(code, status)
    }
}
