import { Suspense } from 'react'
import { TasksClient } from '@/components/project/TasksClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    const params = await ctx.params
    return { title: `Tasks · ${params.project}` }
}

export default function RepoTasksPage() {
    // useSearchParams (?open= deep link from search) requires a Suspense boundary.
    return (
        <Suspense>
            <TasksClient />
        </Suspense>
    )
}
