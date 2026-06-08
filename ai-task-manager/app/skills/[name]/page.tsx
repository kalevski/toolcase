import { notFound } from 'next/navigation'
import { requireRole } from '@/server/page-guards'
import { readSkill, skillExists } from '@/server/fs-workspace'
import { AppShell } from '@/components/AppShell'
import { SkillEditorClient } from '@/components/SkillEditorClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TEMPLATE = `---
name: my-skill
description: One-line summary of what this skill does.
---

# My skill

Describe how Claude should use this skill.
`

export default async function SkillEditorPage({ params }: { params: { name: string } }) {
    const me = await requireRole('standard')

    if (params.name === 'new') {
        return (
            <AppShell me={me} active="skills">
                <SkillEditorClient isNew initialName="" initialContent={TEMPLATE} />
            </AppShell>
        )
    }

    if (!(await skillExists(params.name))) notFound()
    const content = await readSkill(params.name)
    return (
        <AppShell me={me} active="skills">
            <SkillEditorClient isNew={false} initialName={params.name} initialContent={content} />
        </AppShell>
    )
}
