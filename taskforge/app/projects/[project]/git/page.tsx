import { GitClient } from '@/components/project/GitClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: `Git · ${params.project}` }
}

export default function RepoGitPage() {
    return <GitClient />
}
