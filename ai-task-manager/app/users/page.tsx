import { requireRole } from '@/server/page-guards'
import { listUsers } from '@/server/roles'
import { AppShell } from '@/components/AppShell'
import { UsersClient } from '@/components/UsersClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function UsersPage() {
    const me = await requireRole('admin')
    const users = await listUsers()
    return (
        <AppShell me={me} active="users">
            <UsersClient users={users} meId={me.githubId} />
        </AppShell>
    )
}
