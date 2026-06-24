import { requireRole } from '@/server/web/page-guards'
import { listAccountSummaries } from '@/server/services/accounts'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { AccountsClient } from '@/components/AccountsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Accounts' }

export default async function AccountsPage() {
    const me = await requireRole('admin')
    const projects = await getProjectNav()
    const accounts = listAccountSummaries()
    return (
        <AppShell me={me} projects={projects}>
            <AccountsClient accounts={accounts} />
        </AppShell>
    )
}
