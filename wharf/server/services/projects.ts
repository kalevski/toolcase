// Projects service (planning §2, §10). Orchestrates the project repo + slug
// domain logic + membership reads. Routes call this; never a repo directly.

import 'server-only'
import { tx } from '@/server/data/db'
import * as projectRepo from '@/server/data/repositories/project-repo'
import * as memberRepo from '@/server/data/repositories/project-member-repo'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import { ID } from '@/server/infrastructure/ids'
import { uniqueSlug } from '@/server/domain/slug'
import type { Project, ProjectSummary } from '@/server/domain/types'

export class ProjectExistsError extends Error {}
export class ProjectNotFoundError extends Error {}

/** Create a project (owner-only at the route). Slug = slugify(name) + numeric suffix on collision. */
export function createProject(name: string, createdBy: number): Project {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('name required')
    return tx(() => {
        const slug = uniqueSlug(trimmed, (s) => projectRepo.slugExists(s))
        const project: Project = {
            id: ID.project(),
            name: trimmed,
            slug,
            createdBy,
            createdAt: new Date().toISOString(),
        }
        projectRepo.create(project)
        return project
    })
}

export function getProject(id: string): Project | undefined {
    return projectRepo.byId(id)
}

/**
 * Project summaries the caller may see: the global owner sees all; a member sees
 * their own. Each carries the caller's effective project role + env/instance counts.
 */
export function listSummariesForUser(githubId: number, isOwner: boolean): ProjectSummary[] {
    const projects = isOwner ? projectRepo.listAll() : projectRepo.listForUser(githubId)
    return projects.map((project) => {
        const membership = isOwner ? undefined : memberRepo.getMembership(project.id, githubId)
        return {
            project,
            effectiveRole: isOwner ? 'owner' : (membership?.projectRole ?? 'developer'),
            environmentCount: environmentRepo.countByProject(project.id),
            instanceCount: instanceRepo.countByProject(project.id),
        }
    })
}

/** Rename a project (owner-only). Slug stays stable (URLs key off the id). */
export function renameProject(id: string, name: string): Project {
    const project = projectRepo.byId(id)
    if (!project) throw new ProjectNotFoundError()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('name required')
    projectRepo.rename(id, trimmed, project.slug)
    return { ...project, name: trimmed }
}

/** Delete a project (owner-only). Cascades to all child rows via FK ON DELETE CASCADE. */
export function deleteProject(id: string): void {
    if (!projectRepo.byId(id)) throw new ProjectNotFoundError()
    projectRepo.remove(id)
}
