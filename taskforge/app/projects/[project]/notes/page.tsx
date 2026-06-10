import { Suspense } from 'react'
import { NotesClient } from '@/components/project/NotesClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
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
