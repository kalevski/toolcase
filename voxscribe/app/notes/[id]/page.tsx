import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AppShell } from '@/components/AppShell'
import { NoteEditorClient } from '@/components/note/NoteEditorClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Note' }

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
    const me = await requireRole('standard')
    const { id } = await params
    return (
        <AppShell me={me}>
            <NoteEditorClient id={id} />
        </AppShell>
    )
}
