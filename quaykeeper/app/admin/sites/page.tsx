import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminSites } from '@/components/admin/AdminSites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sites · Admin' }

export default function AdminSitesPage() {
    // AuthGate renders the dashboard shell; AdminSites then re-reads GET /api/me
    // and redirects any non-owner away before requesting admin data (every
    // /api/admin/** route is also owner-gated).
    return (
        <AuthGate>
            <AdminSites />
        </AuthGate>
    )
}
