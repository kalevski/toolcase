import { Suspense } from 'react'
import { requireRole } from '@/server/web/page-guards'
import { AgentsClient } from '@/components/project/AgentsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    const params = await ctx.params
    return { title: `Agents · ${params.project}` }
}

export default async function RepoAgentsPage() {
    const me = await requireRole('standard')
    // useSearchParams (tab deep-links) requires a Suspense boundary in app router.
    return (
        <Suspense>
            <AgentsClient isAdmin={me.role === 'owner'} />
        </Suspense>
    )
}
