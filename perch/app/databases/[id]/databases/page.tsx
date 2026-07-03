import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { DbServerDetail } from '@/components/databases/DbServerDetail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Databases' }

export default async function DbServerDatabasesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <AuthGate>
            <DbServerDetail serverId={id} tab="databases" />
        </AuthGate>
    )
}
