import { OverviewClient } from '@/components/project/OverviewClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: params.project }
}

export default function RepoOverviewPage() {
    return <OverviewClient />
}
