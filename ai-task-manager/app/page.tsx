import { requireRole } from '@/server/page-guards'
import { getRepoSummaries } from '@/server/repos'
import { AppShell } from '@/components/AppShell'
import { DashboardClient } from '@/components/DashboardClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const me = await requireRole('standard')
    const repos = await getRepoSummaries()
    return (
        <AppShell me={me} active="repos">
            <DashboardClient repos={repos} />
        </AppShell>
    )
}
