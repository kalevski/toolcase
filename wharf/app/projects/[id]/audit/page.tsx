import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { AuditClient } from '@/components/AuditClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Project audit' }

export default async function ProjectAuditPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAppAccess()
    const { id } = await params
    return (
        <AuthGate>
            <AuditClient projectId={id} title="Project audit log" />
        </AuthGate>
    )
}
