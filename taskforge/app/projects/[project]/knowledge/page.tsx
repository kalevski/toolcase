import { Suspense } from 'react'
import { KnowledgeClient } from '@/components/project/KnowledgeClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: `Knowledge · ${params.project}` }
}

export default function RepoKnowledgePage() {
    // useSearchParams (?open= deep link from search) requires a Suspense boundary.
    return (
        <Suspense>
            <KnowledgeClient />
        </Suspense>
    )
}
