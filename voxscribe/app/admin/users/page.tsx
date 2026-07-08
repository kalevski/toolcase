import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { UsersClient } from '@/components/admin/UsersClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Users' }

export default async function AdminUsersPage() {
    const me = await requireRole('admin')
    return (
        <AppShell me={me}>
            <UsersClient />
        </AppShell>
    )
}
