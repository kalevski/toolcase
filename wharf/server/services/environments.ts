// Environments service (planning §3, §10). Devops+ create/mutate; members read.

import 'server-only'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import * as projectRepo from '@/server/data/repositories/project-repo'
import { ID } from '@/server/infrastructure/ids'
import type { Environment } from '@/server/domain/types'

export class EnvironmentExistsError extends Error {}
export class EnvironmentNotFoundError extends Error {}
export class ProjectNotFoundError extends Error {}

export function listEnvironments(projectId: string): Environment[] {
    return environmentRepo.listByProject(projectId)
}

export function getEnvironment(projectId: string, envId: string): Environment | undefined {
    const env = environmentRepo.byId(envId)
    if (!env || env.projectId !== projectId) return undefined
    return env
}

export function createEnvironment(projectId: string, name: string): Environment {
    if (!projectRepo.byId(projectId)) throw new ProjectNotFoundError()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('name required')
    if (environmentRepo.byProjectAndName(projectId, trimmed)) throw new EnvironmentExistsError()
    const env: Environment = {
        id: ID.environment(),
        projectId,
        name: trimmed,
        sortOrder: environmentRepo.maxSortOrder(projectId) + 1,
        strictRequired: false,
        createdAt: new Date().toISOString(),
    }
    environmentRepo.create(env)
    return env
}

export function updateEnvironment(
    projectId: string,
    envId: string,
    fields: { name?: string; strictRequired?: boolean; sortOrder?: number },
): Environment {
    const env = getEnvironment(projectId, envId)
    if (!env) throw new EnvironmentNotFoundError()
    if (fields.name !== undefined) {
        const trimmed = fields.name.trim()
        if (!trimmed) throw new Error('name required')
        const clash = environmentRepo.byProjectAndName(projectId, trimmed)
        if (clash && clash.id !== envId) throw new EnvironmentExistsError()
        fields.name = trimmed
    }
    environmentRepo.update(envId, fields)
    return { ...env, ...fields, name: fields.name ?? env.name }
}

export function deleteEnvironment(projectId: string, envId: string): void {
    const env = getEnvironment(projectId, envId)
    if (!env) throw new EnvironmentNotFoundError()
    environmentRepo.remove(envId)
}
