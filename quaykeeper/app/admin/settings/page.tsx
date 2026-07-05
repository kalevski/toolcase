import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminSettings } from '@/components/admin/AdminSettings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Settings · Admin' }

export default function AdminSettingsPage() {
    return (
        <AuthGate>
            <AdminSettings />
        </AuthGate>
    )
}
