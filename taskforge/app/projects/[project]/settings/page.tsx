import { SettingsClient } from '@/components/project/SettingsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { project: string } }): Metadata {
    return { title: `Settings · ${params.project}` }
}

export default function RepoSettingsPage() {
    return <SettingsClient />
}
