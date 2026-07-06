import { requireRole } from '@/server/web/page-guards'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { SiteSettingsClient } from '@/components/SiteSettingsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
    const me = await requireRole('owner')
    const projects = await getProjectNav()
    return (
        <AppShell me={me} projects={projects}>
            <SiteSettingsClient />
        </AppShell>
    )
}
