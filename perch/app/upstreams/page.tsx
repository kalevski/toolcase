import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Upstreams } from '@/components/routing/Upstreams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Upstreams · Routing' }

export default function UpstreamsPage() {
    return (
        <AuthGate>
            <Upstreams />
        </AuthGate>
    )
}
