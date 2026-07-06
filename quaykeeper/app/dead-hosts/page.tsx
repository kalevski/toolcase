import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { DeadHosts } from '@/components/routing/DeadHosts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Dead hosts · Routing' }

export default function DeadHostsPage() {
    return (
        <AuthGate>
            <DeadHosts />
        </AuthGate>
    )
}
