import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { FlagsClient } from '@/components/FlagsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Feature flags' }

export default async function FlagsPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAppAccess()
    const { id } = await params
    return (
        <AuthGate>
            <FlagsClient projectId={id} />
        </AuthGate>
    )
}
