import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { DashboardClient } from '@/components/DashboardClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Projects' }

export default async function HomePage() {
    // Server-side gate: no session → /login; signed-in but no access → /no-access.
    await requireAppAccess()
    return (
        <AuthGate>
            <DashboardClient />
        </AuthGate>
    )
}
