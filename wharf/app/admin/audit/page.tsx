import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { AuditClient } from '@/components/AuditClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Audit' }

export default async function AdminAuditPage() {
    await requireRole('owner')
    return (
        <AuthGate>
            <AuditClient title="Global audit log" />
        </AuthGate>
    )
}
