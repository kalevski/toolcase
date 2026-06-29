// GET /api/settings — the PUBLIC instance branding + ingress projection (§13).
// Unauthenticated: the login screen reads the app name + theme before any session
// exists, and the create-site wizard reads the ingress IP for the A-record copy.
// Every field is non-sensitive (branding + public DNS targets). Mutation lives on
// the owner-gated `/api/admin/settings`.

import { NextResponse } from 'next/server'
import * as settings from '@/server/services/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    return NextResponse.json(settings.getPublicSettings())
}
