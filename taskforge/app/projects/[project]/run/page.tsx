import { RunClient } from '@/components/project/RunClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: `Run · ${params.project}` }
}

export default function RepoRunPage() {
    return <RunClient />
}
