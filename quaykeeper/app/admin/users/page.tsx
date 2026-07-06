import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminUsers } from '@/components/admin/AdminUsers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Users · Admin' }

export default function AdminUsersPage() {
    return (
        <AuthGate>
            <AdminUsers />
        </AuthGate>
    )
}
