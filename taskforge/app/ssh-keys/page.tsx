import { requireRole } from '@/server/web/page-guards'
import { listKeys } from '@/server/services/git-keys'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { SshKeysClient } from '@/components/SshKeysClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'SSH keys' }

export default async function SshKeysPage() {
    const me = await requireRole('owner')
    const projects = await getProjectNav()
    const gitKeys = listKeys()
    return (
        <AppShell me={me} projects={projects}>
            <SshKeysClient keys={gitKeys} />
        </AppShell>
    )
}
