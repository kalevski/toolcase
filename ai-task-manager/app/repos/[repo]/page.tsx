import { notFound } from 'next/navigation'
import { requireRole } from '@/server/page-guards'
import { getTasks } from '@/server/repos'
import { repoExists } from '@/server/fs-workspace'
import { engine } from '@/server/execution-manager'
import { status as gitStatus } from '@/server/git'
import { config, canPush } from '@/server/config'
import { AppShell } from '@/components/AppShell'
import { RepoClient } from '@/components/RepoClient'
import type { GitStatus } from '@/server/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RepoPage({ params }: { params: { repo: string } }) {
    const me = await requireRole('standard')
    if (!(await repoExists(params.repo))) notFound()

    const tasks = await getTasks(params.repo)
    const snapshot = engine.snapshot(params.repo)
    let git: GitStatus | null = null
    try {
        git = await gitStatus(params.repo)
    } catch {
        git = null
    }

    return (
        <AppShell me={me} active="repos">
            <RepoClient
                repo={params.repo}
                initialTasks={tasks}
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
            />
        </AppShell>
    )
}
