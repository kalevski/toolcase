import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Streams } from '@/components/routing/Streams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Streams · Routing' }

export default function StreamsPage() {
    return (
        <AuthGate>
            <Streams />
        </AuthGate>
    )
}
