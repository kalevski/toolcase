import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { MembersClient } from '@/components/MembersClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Members' }

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
    await requireRole('owner')
    const { id } = await params
    return (
        <AuthGate>
            <MembersClient projectId={id} />
        </AuthGate>
    )
}
