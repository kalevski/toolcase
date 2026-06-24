import { notFound } from 'next/navigation'
import { requireRole } from '@/server/web/page-guards'
import { readSkill, skillExists } from '@/server/infrastructure/fs-workspace'
import { getProjectNav } from '@/server/services/projects'
import { AppShell } from '@/components/AppShell'
import { SkillEditorClient } from '@/components/SkillEditorClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ name: string }> }): Promise<Metadata> {
    const params = await ctx.params
    return { title: params.name === 'new' ? 'New skill' : params.name }
}

const TEMPLATE = `---
name: my-skill
description: One-line summary of what this skill does.
---

# My skill

Describe how Claude should use this skill.
`

export default async function SkillEditorPage(ctx: { params: Promise<{ name: string }> }) {
    const params = await ctx.params
    const me = await requireRole('standard')
    const projects = await getProjectNav()

    if (params.name === 'new') {
        return (
            <AppShell me={me} projects={projects}>
                <SkillEditorClient isNew initialName="" initialContent={TEMPLATE} />
            </AppShell>
        )
    }

    if (!(await skillExists(params.name))) notFound()
    const content = await readSkill(params.name)
    return (
        <AppShell me={me} projects={projects}>
            <SkillEditorClient isNew={false} initialName={params.name} initialContent={content} />
        </AppShell>
    )
}
