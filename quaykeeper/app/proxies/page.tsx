import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Proxies } from '@/components/routing/Proxies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Proxies · Routing' }

export default function ProxiesPage() {
    return (
        <AuthGate>
            <Proxies />
        </AuthGate>
    )
}
