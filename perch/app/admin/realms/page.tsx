import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminRealms } from '@/components/admin/AdminRealms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'NGINX Servers · Admin' }

export default function AdminRealmsPage() {
    return (
        <AuthGate>
            <AdminRealms />
        </AuthGate>
    )
}
