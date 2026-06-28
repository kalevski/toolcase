import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { SecretsClient } from '@/components/SecretsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Secrets' }

export default async function SecretsPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAppAccess()
    const { id } = await params
    return (
        <AuthGate>
            <SecretsClient projectId={id} />
        </AuthGate>
    )
}
