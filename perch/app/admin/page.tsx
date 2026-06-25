import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { OwnerAdmin } from '@/components/OwnerAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Administration' }

export default function AdminPage() {
    // AuthGate guarantees an authenticated user and renders the dashboard shell;
    // OwnerAdmin then re-reads GET /api/me and redirects any non-owner away before
    // requesting admin data (every /api/admin/** route is also owner-gated).
    return (
        <AuthGate>
            <OwnerAdmin />
        </AuthGate>
    )
}
