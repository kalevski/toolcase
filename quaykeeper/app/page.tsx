import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { DashboardHome } from '@/components/DashboardHome'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Static Sites' }

export default function HomePage() {
    // The client AuthGate calls GET /api/me, redirects unauthenticated users to
    // /login, and renders the authenticated shell around the page content.
    return (
        <AuthGate>
            <DashboardHome />
        </AuthGate>
    )
}
