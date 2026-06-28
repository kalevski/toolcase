import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { SettingsClient } from '@/components/SettingsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Settings' }

export default async function AdminSettingsPage() {
    await requireRole('owner')
    return (
        <AuthGate>
            <SettingsClient />
        </AuthGate>
    )
}
