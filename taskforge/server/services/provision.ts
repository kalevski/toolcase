// Project provisioning: create a self-contained project folder
// (`/workspace/projects/<name>`) by cloning a git repo into `repo/`, laying out
// `tasks/` + `knowledge/` + `notes/`, linking the shared skills dir, and writing
// the root CLAUDE.md from the canonical template (§8 — instant, deterministic,
// no agent spawn). Also handles deletion.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import * as git from '@/server/infrastructure/git'
import { engine } from '@/server/services/execution-manager'
import {
    projectPath,
    projectTasksDir,
    projectKnowledgeDir,
    projectNotesDir,
    projectSkillsLink,
    projectExists,
} from '@/server/infrastructure/fs-workspace'
import * as projectRepo from '@/server/data/repositories/project-repo'
import * as searchRepo from '@/server/data/repositories/search-repo'
import { ensureImported } from '@/server/services/migrate-fs'
import { PROJECT_CLAUDE_MD } from '@/server/templates/project-claude'

export class ProjectExistsError extends Error {}
export class ProjectLockedError extends Error {}

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
 * Write (or reset) the root CLAUDE.md from the pregenerated template (§8) —
 * synchronous, deterministic, never spawns the agent.
 */
export async function writeProjectClaudeMd(name: string): Promise<void> {
    const target = path.join(projectPath(name), 'CLAUDE.md')
    await fs.writeFile(target, PROJECT_CLAUDE_MD.replace(/\{\{PROJECT_NAME\}\}/g, name), 'utf8')
}

export interface CreateProjectInput {
    name: string
    gitUrl: string
    branch?: string
}

/**
 * Create a project: clone → scaffold dirs → link skills → CLAUDE.md → metadata.
 * Atomic: any failure after the root dir is created removes the half-built dir.
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
        // Embed the push token in origin's URL so the agent can push/fetch
        // directly from inside repo/ (no-op without GIT_REMOTE_TOKEN / non-HTTPS).
        await git.setOriginUrlWithToken(name, gitUrl)
        await Promise.all([
            fs.mkdir(projectTasksDir(name), { recursive: true }),
            fs.mkdir(projectKnowledgeDir(name), { recursive: true }),
            fs.mkdir(projectNotesDir(name), { recursive: true }),
        ])
        await linkSkills(name)
        // Instant template write — every project is oriented from second zero.
        await writeProjectClaudeMd(name)
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
    searchRepo.removeProject(name)
}
