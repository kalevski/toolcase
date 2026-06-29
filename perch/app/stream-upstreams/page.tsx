import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { StreamUpstreams } from '@/components/routing/StreamUpstreams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Stream upstreams · Routing' }

export default function StreamUpstreamsPage() {
    return (
        <AuthGate>
            <StreamUpstreams />
        </AuthGate>
    )
}
