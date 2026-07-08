import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { DashboardClient } from '@/components/DashboardClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const me = await requireRole('standard')
    return (
        <AppShell me={me}>
            <DashboardClient />
        </AppShell>
    )
}
