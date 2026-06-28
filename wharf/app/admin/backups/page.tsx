import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { BackupsClient } from '@/components/BackupsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Backups' }

export default async function AdminBackupsPage() {
    await requireRole('owner')
    return (
        <AuthGate>
            <BackupsClient />
        </AuthGate>
    )
}
