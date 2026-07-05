import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminDbServers } from '@/components/admin/AdminDbServers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'DB Servers · Admin' }

export default function AdminDbServersPage() {
    return (
        <AuthGate>
            <AdminDbServers />
        </AuthGate>
    )
}
