import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Instances } from '@/components/config/Instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Instances' }

export default function InstancesPage() {
    return (
        <AuthGate>
            <Instances />
        </AuthGate>
    )
}
