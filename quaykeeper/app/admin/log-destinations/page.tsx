import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminLogDestinations } from '@/components/admin/AdminLogDestinations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Log destinations · Admin' }

export default function AdminLogDestinationsPage() {
    return (
        <AuthGate>
            <AdminLogDestinations />
        </AuthGate>
    )
}
