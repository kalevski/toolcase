import type { Metadata } from 'next'
import { requireSession } from '@/server/web/page-guards'
import { NoAccessClient } from '@/components/NoAccessClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'No access' }

// Guest landing (spec §9): authenticated via GitHub but not yet provisioned by
// an admin (or gated out by the allowlist).
export default async function NoAccessPage() {
    const me = await requireSession()
    return <NoAccessClient login={me.login} />
}
