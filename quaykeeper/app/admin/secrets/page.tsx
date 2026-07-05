import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminSecrets } from '@/components/admin/AdminSecrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Secrets · Admin' }

export default function AdminSecretsPage() {
    return (
        <AuthGate>
            <AdminSecrets />
        </AuthGate>
    )
}
