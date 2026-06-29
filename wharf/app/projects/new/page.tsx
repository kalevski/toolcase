import type { Metadata } from 'next'
import { requireRole } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { NewProjectClient } from '@/components/NewProjectClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'New project' }

export default async function NewProjectPage() {
    await requireRole('owner')
    return (
        <AuthGate>
            <NewProjectClient />
        </AuthGate>
    )
}
