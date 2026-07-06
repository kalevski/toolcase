import { requireRole } from '@/server/web/page-guards'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { HealthClient } from '@/components/HealthClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Health' }

export default async function HealthPage() {
    const me = await requireRole('owner')
    const projects = await getProjectNav()
    return (
        <AppShell me={me} projects={projects}>
            <HealthClient projects={projects.map((p) => p.name)} />
        </AppShell>
    )
}
