import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { NoteEditorClient } from '@/components/note/NoteEditorClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'New note' }

export default async function NewNotePage() {
    const me = await requireRole('standard')
    return (
        <AppShell me={me}>
            <NoteEditorClient />
        </AppShell>
    )
}
