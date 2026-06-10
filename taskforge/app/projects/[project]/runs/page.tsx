import { RunsClient } from '@/components/project/RunsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: `Runs · ${params.project}` }
}

export default function RepoRunsPage() {
    return <RunsClient />
}
