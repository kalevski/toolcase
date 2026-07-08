import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { LibraryClient } from '@/components/transcription/LibraryClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Library' }

export default async function LibraryPage() {
    const me = await requireRole('standard')
    return (
        <AppShell me={me}>
            <LibraryClient />
        </AppShell>
    )
}
