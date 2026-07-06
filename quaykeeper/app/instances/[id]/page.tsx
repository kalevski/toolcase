import { redirect } from 'next/navigation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// /instances/{id} has no page of its own — the tabs are the sub-nav (Variables,
// Flags, Settings); bare /instances/{id} bounces to Variables.
export default async function InstancePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/instances/${id}/variables`)
}
