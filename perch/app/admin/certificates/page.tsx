import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminCertificates } from '@/components/admin/AdminCertificates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Certificates · Admin' }

export default function AdminCertificatesPage() {
    return (
        <AuthGate>
            <AdminCertificates />
        </AuthGate>
    )
}
