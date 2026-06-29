import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { UsersClient } from '@/components/UsersClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Users' }

export default async function AdminUsersPage() {
    await requireRole('owner')
    return (
        <AuthGate>
            <UsersClient />
        </AuthGate>
    )
}
