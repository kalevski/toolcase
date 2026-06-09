// Project provisioning: create a self-contained project folder
// (`/workspace/projects/<name>`) by cloning a git repo into `repo/`, laying out
// `tasks/` + `knowledge/`, and linking the shared skills dir. A root CLAUDE.md
// that orients future runs is generated on demand (see `generateProjectClaudeMd`),
// not at creation time. Also handles deletion.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { runAgentOnce } from '@/server/infrastructure/agent'
import * as git from '@/server/infrastructure/git'
import { engine } from '@/server/services/execution-manager'
import {
    projectPath,
    projectTasksDir,
    projectKnowledgeDir,
    projectSkillsLink,
    projectExists,
} from '@/server/infrastructure/fs-workspace'
import * as projectRepo from '@/server/data/repositories/project-repo'
import { ensureImported } from '@/server/services/migrate-fs'

export class ProjectExistsError extends Error {}
export class ProjectLockedError extends Error {}

const CLAUDE_MD_PROMPT = [
    'Write a concise CLAUDE.md at the root of the current directory (a TaskForge project',
    'workspace). It must orient any agent that works here, explaining the layout:',
    '',
    '- `repo/`      — the cloned git repository. Apply ALL code changes inside `repo/`.',
    '- `knowledge/` — living documentation of the codebase; read `knowledge/index.md` first.',
    '- `tasks/`     — queued task files managed by TaskForge.',
    '',
    'Keep it short (well under 40 lines). Write ONLY the CLAUDE.md file; output nothing else.',
].join('\n')

function fallbackClaudeMd(name: string): string {
    return [
        `# ${name}`,
        '',
        'TaskForge project workspace. The agent runs at this root, so every folder below is reachable.',
        '',
        '## Layout',
        '',
        '- `repo/` — the cloned git repository. **Apply all code changes inside `repo/`.**',
        '- `knowledge/` — living documentation of the codebase. **Read `knowledge/index.md` first.**',
        '- `tasks/` — queued task files managed by TaskForge.',
        '',
        'Do not stage, commit, or push — TaskForge records task status and handles commits.',
        '',
    ].join('\n')
}

/** Symlink `<project>/.claude/skills → config.skillsDir` so the agent (cwd = project root) discovers the shared skills. No-op if the skills dir is absent. */
async function linkSkills(name: string): Promise<void> {
    try {
        await fs.access(config.skillsDir)
    } catch {
        return // no shared skills dir configured/mounted
    }
    const link = projectSkillsLink(name)
    await fs.mkdir(path.dirname(link), { recursive: true })
    await fs.symlink(config.skillsDir, link, 'dir').catch(() => {})
}

/**
 * Ask the agent to write a root CLAUDE.md (cwd = project root). Falls back to a
 * deterministic template if the agent times out, errors, or leaves no file, so
 * the project is always oriented before the first run.
 */
export async function generateProjectClaudeMd(name: string): Promise<void> {
    const root = projectPath(name)
    const target = path.join(root, 'CLAUDE.md')
    try {
        await runAgentOnce({
            cwd: root,
            model: config.defaultModel,
            prompt: CLAUDE_MD_PROMPT,
            timeoutMs: config.generateTimeoutMs,
            extraArgs: '--print --output-format=text --permission-mode acceptEdits',
        })
    } catch {
        /* fall through to the fallback check */
    }
    try {
        await fs.access(target)
    } catch {
        await fs.writeFile(target, fallbackClaudeMd(name), 'utf8')
    }
}

export interface CreateProjectInput {
    name: string
    gitUrl: string
    branch?: string
}

/**
 * Create a project: clone → scaffold dirs → link skills → metadata.
 * The root CLAUDE.md is NOT written here — generate it on demand via
 * `generateProjectClaudeMd`. Atomic: any failure after the root dir is created
 * removes the half-built dir.
 */
export async function createProject({ name, gitUrl, branch }: CreateProjectInput): Promise<void> {
    const root = projectPath(name) // validates the name (throws UnsafePathError)
    git.assertSafeGitUrl(gitUrl) // validate before any filesystem work
    if (await projectExists(name)) {
        throw new ProjectExistsError(`Project already exists: ${name}`)
    }

    await fs.mkdir(root, { recursive: true })
    try {
        await git.clone(name, gitUrl, branch) // creates repo/
        await Promise.all([
            fs.mkdir(projectTasksDir(name), { recursive: true }),
            fs.mkdir(projectKnowledgeDir(name), { recursive: true }),
        ])
        await linkSkills(name)
        projectRepo.upsertProject({
            name,
            gitUrl,
            branch: branch ?? null,
            createdAt: new Date().toISOString(),
        })
    } catch (err) {
        await fs.rm(root, { recursive: true, force: true }).catch(() => {})
        throw err
    }
}

export interface ProjectMeta {
    gitUrl?: string
    branch?: string | null
    createdAt?: string
}

/** Read a project's metadata from SQLite, or `{}` if unknown. */
export async function readProjectMeta(name: string): Promise<ProjectMeta> {
    await ensureImported()
    const row = projectRepo.getProject(name)
    return row ? { gitUrl: row.gitUrl, branch: row.branch, createdAt: row.createdAt } : {}
}

/** Delete a project folder + its DB rows. Refuses while a run holds the lock. */
export async function deleteProject(name: string): Promise<void> {
    const root = projectPath(name) // validates the name
    if (engine.isLocked(name)) {
        throw new ProjectLockedError(`A run is in progress for ${name}`)
    }
    await fs.rm(root, { recursive: true, force: true })
    projectRepo.deleteProject(name)
}
