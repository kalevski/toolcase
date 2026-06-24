import { Suspense } from 'react'
import { NotesClient } from '@/components/project/NotesClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    const params = await ctx.params
    return { title: `Notes · ${params.project}` }
}

export default function RepoNotesPage() {
    // useSearchParams (?open= deep link from search) requires a Suspense boundary.
    return (
        <Suspense>
            <NotesClient />
        </Suspense>
    )
}
