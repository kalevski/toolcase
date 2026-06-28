import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { ProjectClient } from '@/components/ProjectClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Project' }

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAppAccess()
    const { id } = await params
    return (
        <AuthGate>
            <ProjectClient projectId={id} />
        </AuthGate>
    )
}
