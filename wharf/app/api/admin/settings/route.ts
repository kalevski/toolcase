// GET /api/admin/settings — read the full effective instance settings.
// PUT /api/admin/settings — replace any subset ({ appName?, tagline?, theme?,
//     brandColor? }). Returns the new effective record.
//
// Both owner-only (`guard('owner')`) — a non-owner session is rejected 401/403 and
// never reaches the service. Validation + the audit entry live in
// `services/settings.ts`.

import { guard, json, error } from '@/server/web/http'
import { getSettings, updateSettings, httpErrorFor } from '@/server/services/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    return json(getSettings())
}

export async function PUT(req: Request) {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return error('invalid_json', 400)
    }

    try {
        const actor = { githubId: auth.session.sub, login: auth.session.login }
        return json(updateSettings(actor, body))
    } catch (err) {
        const { status, code } = httpErrorFor(err)
        return error(code, status)
    }
}
