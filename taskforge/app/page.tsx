import { requireRole } from '@/server/web/page-guards'
import { getProjectSummaries } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { DashboardClient } from '@/components/DashboardClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
    const me = await requireRole('standard')
    const projects = await getProjectSummaries()
    const projectNav = projects.map((p) => ({ name: p.name, state: p.state }))
    return (
        <AppShell me={me} projects={projectNav}>
            <DashboardClient projects={projects} />
        </AppShell>
    )
}
