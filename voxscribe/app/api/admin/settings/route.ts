// GET /api/admin/settings — the full effective instance settings.
// PUT /api/admin/settings — replace any subset ({ appName?, tagline?,
//     secondaryText?, theme?, themeVariant?, brandColor? }); returns the new
//     effective record. Both admin-only.

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import { getSettings, updateSettings, SettingsError, httpErrorFor } from '@/server/services/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    return json(getSettings())
}

export async function PUT(req: NextRequest) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    const body = await req.json().catch(() => ({}))
    try {
        const { settings, detail } = updateSettings(body)
        if (detail) audit(auth, 'settings.update', detail)
        return json(settings)
    } catch (err) {
        if (err instanceof SettingsError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }
}
