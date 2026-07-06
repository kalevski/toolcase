import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminGlobalVars } from '@/components/admin/AdminGlobalVars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Global variables · Admin' }

export default function AdminGlobalVarsPage() {
    return (
        <AuthGate>
            <AdminGlobalVars />
        </AuthGate>
    )
}
