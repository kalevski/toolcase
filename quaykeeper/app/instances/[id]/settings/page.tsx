import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { InstanceDetail } from '@/components/config/InstanceDetail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Settings · Instance' }

export default async function InstanceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <AuthGate>
            <InstanceDetail instanceId={id} tab="settings" />
        </AuthGate>
    )
}
