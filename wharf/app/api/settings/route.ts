// GET /api/settings — the PUBLIC instance branding projection. Unauthenticated: the
// login screen reads the app name + theme + brand colour before any session exists.
// Every field is non-sensitive branding. Mutation lives on the owner-gated
// `/api/admin/settings`.

import { json } from '@/server/web/http'
import { getPublicSettings } from '@/server/services/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    return json(getPublicSettings())
}
