import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { SiteDetail } from '@/components/SiteDetail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Site' }

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <AuthGate>
            <SiteDetail siteId={id} />
        </AuthGate>
    )
}
