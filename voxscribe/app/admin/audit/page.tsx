import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { AuditClient } from '@/components/admin/AuditClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Audit' }

export default async function AdminAuditPage() {
    const me = await requireRole('admin')
    return (
        <AppShell me={me}>
            <AuditClient />
        </AppShell>
    )
}
