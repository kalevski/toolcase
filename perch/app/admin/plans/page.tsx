import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminPlans } from '@/components/admin/AdminPlans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Plans · Admin' }

export default function AdminPlansPage() {
    return (
        <AuthGate>
            <AdminPlans />
        </AuthGate>
    )
}
