// GET /api/settings — the PUBLIC instance branding + theme projection.
// Unauthenticated: the login screen reads the app name + theme before any
// session exists. Every field is non-sensitive branding; mutation lives on the
// admin-gated /api/admin/settings.

import { json } from '@/server/web/http'
import { getPublicSettings } from '@/server/services/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    return json(getPublicSettings())
}
