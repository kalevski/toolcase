// Instances service (planning §3, §10). Devops+ create/mutate; members read.

import 'server-only'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import { ID } from '@/server/infrastructure/ids'
import type { Instance } from '@/server/domain/types'

export class InstanceExistsError extends Error {}
export class InstanceNotFoundError extends Error {}
export class EnvironmentNotFoundError extends Error {}

function envInProject(projectId: string, envId: string) {
    const env = environmentRepo.byId(envId)
    return env && env.projectId === projectId ? env : undefined
}

export function listInstances(projectId: string, envId: string): Instance[] {
    if (!envInProject(projectId, envId)) throw new EnvironmentNotFoundError()
    return instanceRepo.listByEnvironment(envId)
}

export function createInstance(projectId: string, envId: string, name: string): Instance {
    if (!envInProject(projectId, envId)) throw new EnvironmentNotFoundError()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('name required')
    if (instanceRepo.byEnvAndName(envId, trimmed)) throw new InstanceExistsError()
    const created = { id: ID.instance(), environmentId: envId, name: trimmed, createdAt: new Date().toISOString() }
    instanceRepo.create(created)
    return instanceRepo.byId(created.id)!
}

/** Load an instance, asserting it belongs to `projectId` (via its environment). */
export function getInstanceInProject(projectId: string, instanceId: string): Instance | undefined {
    const inst = instanceRepo.byId(instanceId)
    if (!inst) return undefined
    const env = environmentRepo.byId(inst.environmentId)
    if (!env || env.projectId !== projectId) return undefined
    return inst
}

/** Instance detail joined with its environment name (instance detail page). */
export function getInstanceDetail(
    projectId: string,
    instanceId: string,
): { instance: Instance; environmentId: string; environmentName: string } | undefined {
    const inst = instanceRepo.byId(instanceId)
    if (!inst) return undefined
    const env = environmentRepo.byId(inst.environmentId)
    if (!env || env.projectId !== projectId) return undefined
    return { instance: inst, environmentId: env.id, environmentName: env.name }
}

export function renameInstance(projectId: string, instanceId: string, name: string): Instance {
    const inst = getInstanceInProject(projectId, instanceId)
    if (!inst) throw new InstanceNotFoundError()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('name required')
    const clash = instanceRepo.byEnvAndName(inst.environmentId, trimmed)
    if (clash && clash.id !== instanceId) throw new InstanceExistsError()
    instanceRepo.rename(instanceId, trimmed)
    return { ...inst, name: trimmed }
}

export function deleteInstance(projectId: string, instanceId: string): void {
    const inst = getInstanceInProject(projectId, instanceId)
    if (!inst) throw new InstanceNotFoundError()
    instanceRepo.remove(instanceId)
}
