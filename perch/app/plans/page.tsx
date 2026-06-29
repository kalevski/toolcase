import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { PlansView } from '@/components/PlansView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Plans' }

export default function PlansPage() {
    // The client AuthGate calls GET /api/me, redirects unauthenticated users to
    // /login, and renders the authenticated shell around the plans view. PlansView
    // fetches its own /api/me + /api/sites + /api/plans context.
    return (
        <AuthGate>
            <PlansView />
        </AuthGate>
    )
}
