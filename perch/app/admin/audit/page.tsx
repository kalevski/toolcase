import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminAudit } from '@/components/admin/AdminAudit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Audit · Admin' }

export default function AdminAuditPage() {
    return (
        <AuthGate>
            <AdminAudit />
        </AuthGate>
    )
}
