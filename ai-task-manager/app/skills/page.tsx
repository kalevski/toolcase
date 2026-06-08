import { requireRole } from '@/server/page-guards'
import { listSkills } from '@/server/fs-workspace'
import { AppShell } from '@/components/AppShell'
import { SkillsClient } from '@/components/SkillsClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function SkillsPage() {
    const me = await requireRole('standard')
    const skills = await listSkills()
    return (
        <AppShell me={me} active="skills">
            <SkillsClient skills={skills} />
        </AppShell>
    )
}
