import { SettingsClient } from '@/components/project/SettingsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    const params = await ctx.params
    return { title: `Settings · ${params.project}` }
}

export default function RepoSettingsPage() {
    return <SettingsClient />
}
