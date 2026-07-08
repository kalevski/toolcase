import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { ModelsClient } from '@/components/admin/ModelsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Models' }

export default async function AdminModelsPage() {
    const me = await requireRole('admin')
    return (
        <AppShell me={me}>
            <ModelsClient />
        </AppShell>
    )
}
