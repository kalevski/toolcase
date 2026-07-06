import { requireRole } from '@/server/web/page-guards'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { AuditClient } from '@/components/AuditClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Audit log' }

export default async function AuditPage() {
    const me = await requireRole('owner')
    const projects = await getProjectNav()
    return (
        <AppShell me={me} projects={projects}>
            <AuditClient />
        </AppShell>
    )
}
