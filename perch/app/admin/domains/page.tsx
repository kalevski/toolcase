import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminDomains } from '@/components/admin/AdminDomains'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Domains · Admin' }

export default function AdminDomainsPage() {
    return (
        <AuthGate>
            <AdminDomains />
        </AuthGate>
    )
}
