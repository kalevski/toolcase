import { notFound } from 'next/navigation'
import { requireRole } from '@/server/web/page-guards'
import { getTasks, getProjectNav, getKnowledge, getNotes } from '@/server/services/projects'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import { engine } from '@/server/services/execution-manager'
import { listAgentKinds } from '@/server/services/agent-sessions'
import { effectiveSettings } from '@/server/services/settings'
import { ensureSchedulerStarted } from '@/server/services/scheduler'
import { status as gitStatus } from '@/server/infrastructure/git'
import { config, canPush } from '@/server/config'
import * as agentPromptRepo from '@/server/data/repositories/agent-prompt-repo'
import { AppShell } from '@/components/AppShell'
import { ProjectProvider } from '@/components/ProjectContext'
import { ProjectHeader } from '@/components/ProjectHeader'
import { ActivityBar } from '@/components/project/ActivityBar'
import { SearchPalette } from '@/components/project/SearchPalette'
import type { AgentKind, AgentPromptRecord, GitStatus } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function ProjectLayout({
    params,
    children,
}: {
    params: { project: string }
    children: React.ReactNode
}) {
    const me = await requireRole('standard')
    if (!(await projectExists(params.project))) notFound()
    ensureSchedulerStarted() // belt-and-braces next to instrumentation.ts

    const [tasks, projects, knowledge, notes] = await Promise.all([
        getTasks(params.project),
        getProjectNav(),
        getKnowledge(params.project),
        getNotes(params.project),
    ])
    const snapshot = engine.snapshot(params.project)
    let git: GitStatus | null
    try {
        git = await gitStatus(params.project)
    } catch {
        git = null
    }
    let agentPrompts: Partial<Record<AgentKind, AgentPromptRecord>>
    try {
        agentPrompts = agentPromptRepo.getAll(params.project)
    } catch {
        agentPrompts = {}
    }
    // E1 — the run form initializes from the project's effective settings.
    const eff = effectiveSettings(params.project)
    const agentKinds = listAgentKinds().map(({ kind, label, custom }) => ({ kind, label, custom }))

    return (
        <AppShell me={me} projects={projects}>
            <ProjectProvider
                key={params.project}
                project={params.project}
                initialTasks={tasks}
                initialKnowledge={knowledge}
                initialNotes={notes}
                initialSnapshot={snapshot}
                initialGit={git}
                initialAgentPrompts={agentPrompts}
                config={{
                    modelCatalog: config.modelCatalog,
                    defaultModel: eff.defaultModel,
                    commitAfter: eff.commitAfter,
                    commitMessageMode: eff.commitMessageMode,
                    commitModel: eff.commitModel,
                    warmSession: eff.warmSession,
                    canPush: canPush(),
                    pushAfter: eff.pushAfter,
                    branchPerRun: eff.branchPerRun,
                    review: eff.review,
                    openPr: eff.openPr,
                    agentKinds,
                }}
            >
                <ActivityBar />
                <ProjectHeader />
                <SearchPalette />
                {children}
            </ProjectProvider>
        </AppShell>
    )
}
