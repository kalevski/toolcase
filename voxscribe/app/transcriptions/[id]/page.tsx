import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { DetailClient } from '@/components/transcription/DetailClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Transcription' }

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const me = await requireRole('standard')
    const { id } = await params
    return (
        <AppShell me={me}>
            <DetailClient id={id} />
        </AppShell>
    )
}
