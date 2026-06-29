import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { NotesClient } from '@/components/NotesClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Notes' }

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAppAccess()
    const { id } = await params
    return (
        <AuthGate>
            <NotesClient projectId={id} />
        </AuthGate>
    )
}
