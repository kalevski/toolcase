import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { DbServersList } from '@/components/databases/DbServersList'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Databases' }

export default function DatabasesPage() {
    return (
        <AuthGate>
            <DbServersList />
        </AuthGate>
    )
}
