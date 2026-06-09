import { requireRole } from '@/server/web/page-guards'
import { listSkills } from '@/server/infrastructure/fs-workspace'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { SkillsClient } from '@/components/SkillsClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Skills' }

export default async function SkillsPage() {
    const me = await requireRole('standard')
    const [skills, projects] = await Promise.all([listSkills(), getProjectNav()])
    return (
        <AppShell me={me} projects={projects}>
            <SkillsClient skills={skills} />
        </AppShell>
    )
}
