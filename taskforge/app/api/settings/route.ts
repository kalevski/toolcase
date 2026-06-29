// Public instance branding (`GET /api/settings`) — readable by anyone, so the login
// screen + the client branding context can pull the secondary brand text before auth.
// Allow-listed in middleware (`PUBLIC_EXACT`).

import { json } from '@/server/web/http'
import { getPublicSettings } from '@/server/services/site-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    return json(getPublicSettings())
}
