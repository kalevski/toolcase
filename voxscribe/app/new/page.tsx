import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { UploadClient } from '@/components/transcription/UploadClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'New transcription' }

export default async function NewPage() {
    const me = await requireRole('standard')
    return (
        <AppShell me={me}>
            <UploadClient />
        </AppShell>
    )
}
