import { RunClient } from '@/components/project/RunClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    const params = await ctx.params
    return { title: `Run · ${params.project}` }
}

export default function RepoRunPage() {
    return <RunClient />
}
