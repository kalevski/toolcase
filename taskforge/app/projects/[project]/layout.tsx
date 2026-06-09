import { notFound } from 'next/navigation'
import { requireRole } from '@/server/web/page-guards'
import { getTasks, getProjectNav, getKnowledge } from '@/server/services/projects'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import { engine } from '@/server/services/execution-manager'
import { status as gitStatus } from '@/server/infrastructure/git'
import { config, canPush } from '@/server/config'
import { AppShell } from '@/components/AppShell'
import { ProjectProvider } from '@/components/ProjectContext'
import { ProjectHeader } from '@/components/ProjectHeader'
import type { GitStatus } from '@/server/domain/types'

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

    const [tasks, projects, knowledge] = await Promise.all([
        getTasks(params.project),
        getProjectNav(),
        getKnowledge(params.project),
    ])
    const snapshot = engine.snapshot(params.project)
    let git: GitStatus | null
    try {
        git = await gitStatus(params.project)
    } catch {
        git = null
    }

    return (
        <AppShell me={me} projects={projects}>
            <ProjectProvider
                key={params.project}
                project={params.project}
                initialTasks={tasks}
                initialKnowledge={knowledge}
                initialSnapshot={snapshot}
                initialGit={git}
                config={{
                    modelCatalog: config.modelCatalog,
                    defaultModel: config.defaultModel,
                    commitAfter: config.commitAfterTask,
                    commitMessageMode: config.commitMessageMode,
                    commitModel: config.commitModel,
                    warmSession: config.warmSession,
                    canPush: canPush(),
                }}
            >
                <ProjectHeader />
                {children}
            </ProjectProvider>
        </AppShell>
    )
}
