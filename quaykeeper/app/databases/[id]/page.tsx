import { redirect } from 'next/navigation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// /databases/{id} has no page of its own — the tabs are the sub-nav (Databases,
// Users, Access); the bare route bounces to Databases.
export default async function DbServerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/databases/${id}/databases`)
}
