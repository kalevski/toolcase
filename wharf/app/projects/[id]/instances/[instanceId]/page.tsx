import type { Metadata } from 'next'
import { requireAppAccess } from '@/server/web/page-guards'
import { AuthGate } from '@/components/AuthGate'
import { InstanceDetailClient } from '@/components/InstanceDetailClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Instance' }

export default async function InstancePage({
    params,
}: {
    params: Promise<{ id: string; instanceId: string }>
}) {
    await requireAppAccess()
    const { id, instanceId } = await params
    return (
        <AuthGate>
            <InstanceDetailClient projectId={id} instanceId={instanceId} />
        </AuthGate>
    )
}
