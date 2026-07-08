import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { NotesClient } from '@/components/note/NotesClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Notes' }

export default async function NotesPage() {
    const me = await requireRole('standard')
    return (
        <AppShell me={me}>
            <NotesClient />
        </AppShell>
    )
}
