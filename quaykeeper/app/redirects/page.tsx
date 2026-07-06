import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Redirects } from '@/components/routing/Redirects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Redirects · Routing' }

export default function RedirectsPage() {
    return (
        <AuthGate>
            <Redirects />
        </AuthGate>
    )
}
