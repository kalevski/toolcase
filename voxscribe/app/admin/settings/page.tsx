import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { SettingsClient } from '@/components/admin/SettingsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Settings' }

export default async function AdminSettingsPage() {
    const me = await requireRole('admin')
    return (
        <AppShell me={me}>
            <SettingsClient />
        </AppShell>
    )
}
