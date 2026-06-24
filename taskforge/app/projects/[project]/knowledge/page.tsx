import { Suspense } from 'react'
import { KnowledgeClient } from '@/components/project/KnowledgeClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    const params = await ctx.params
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
