import { requireRole } from '@/server/page-guards'
import { listUsers } from '@/server/roles'
import { getProjectNav } from '@/server/projects'
import { AppShell } from '@/components/AppShell'
import { UsersClient } from '@/components/UsersClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Users' }

export default async function UsersPage() {
    const me = await requireRole('admin')
    const [users, projects] = await Promise.all([listUsers(), getProjectNav()])
    return (
        <AppShell me={me} projects={projects}>
            <UsersClient users={users} meId={me.githubId} />
        </AppShell>
    )
}
