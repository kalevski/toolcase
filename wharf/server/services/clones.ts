// Clone service (planning §8.6). Deep-copies an environment (with its vars +
// instances + instance vars) or a whole project (environments, instances, env
// vars, secrets, flags + per-env values, notes). Instance FETCH KEYS are never
// copied — each clone re-mints its own. Memberships are not copied. Each clone
// runs in ONE transaction, so it uses repositories directly (services that open
// their own tx must not be nested).

import 'server-only'
import { tx } from '@/server/data/db'
import * as projectRepo from '@/server/data/repositories/project-repo'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as envVarRepo from '@/server/data/repositories/env-var-repo'
import * as secretRepo from '@/server/data/repositories/secret-repo'
import * as featureFlagRepo from '@/server/data/repositories/feature-flag-repo'
import * as noteRepo from '@/server/data/repositories/note-repo'
import { encrypt } from '@/server/infrastructure/cipher'
import { ID } from '@/server/infrastructure/ids'
import { uniqueSlug } from '@/server/domain/slug'
import type { Environment, Project } from '@/server/domain/types'

export class EnvironmentExistsError extends Error {}
export class EnvironmentNotFoundError extends Error {}
export class ProjectNotFoundError extends Error {}

/** Deep-copy an environment within the same project (devops+). */
export function cloneEnvironment(projectId: string, envId: string, newName: string): Environment {
    const src = environmentRepo.byId(envId)
    if (!src || src.projectId !== projectId) throw new EnvironmentNotFoundError()
    const name = newName.trim()
    if (!name) throw new Error('name required')
    if (environmentRepo.byProjectAndName(projectId, name)) throw new EnvironmentExistsError()

    return tx(() => {
        const now = new Date().toISOString()
        const newEnv: Environment = {
            id: ID.environment(),
            projectId,
            name,
            sortOrder: environmentRepo.maxSortOrder(projectId) + 1,
            strictRequired: src.strictRequired,
            createdAt: now,
        }
        environmentRepo.create(newEnv)

        // env-scope baseline vars (secrets are project-level → same refs)
        for (const row of envVarRepo.listEnvironmentScope(envId)) {
            envVarRepo.insert({ ...row, id: ID.envVar(), environmentId: newEnv.id, createdAt: now, updatedAt: now })
        }
        // instances + their instance-scope vars (keys NOT copied)
        for (const inst of instanceRepo.listByEnvironment(envId)) {
            const newInstId = ID.instance()
            instanceRepo.create({ id: newInstId, environmentId: newEnv.id, name: inst.name, createdAt: now })
            for (const row of envVarRepo.listInstanceScope(inst.id)) {
                envVarRepo.insert({
                    ...row,
                    id: ID.envVar(),
                    environmentId: newEnv.id,
                    instanceId: newInstId,
                    createdAt: now,
                    updatedAt: now,
                })
            }
        }
        return newEnv
    })
}

/** Deep-copy a whole project (owner). `copySecretValues` re-encrypts secret values
 *  into the clone; otherwise the keys are cloned with empty values (decision #14). */
export function cloneProject(
    srcId: string,
    newName: string,
    copySecretValues: boolean,
    createdBy: number,
): Project {
    const src = projectRepo.byId(srcId)
    if (!src) throw new ProjectNotFoundError()
    const name = newName.trim()
    if (!name) throw new Error('name required')

    return tx(() => {
        const now = new Date().toISOString()
        const newProject: Project = {
            id: ID.project(),
            name,
            slug: uniqueSlug(name, (s) => projectRepo.slugExists(s)),
            createdBy,
            createdAt: now,
        }
        projectRepo.create(newProject)

        // secrets (remap ids for secret_ref env vars)
        const secretMap = new Map<string, string>()
        for (const meta of secretRepo.listByProject(srcId)) {
            const newSecretId = ID.secret()
            secretMap.set(meta.id, newSecretId)
            const valueEnc = copySecretValues ? (secretRepo.valueEnc(meta.id) ?? encrypt('')) : encrypt('')
            secretRepo.insert({
                id: newSecretId,
                projectId: newProject.id,
                key: meta.key,
                valueEnc,
                description: meta.description,
                createdBy,
                createdAt: now,
                updatedAt: now,
            })
        }

        // environments + instances (remap ids)
        const envMap = new Map<string, string>()
        const instMap = new Map<string, string>()
        for (const env of environmentRepo.listByProject(srcId)) {
            const newEnvId = ID.environment()
            envMap.set(env.id, newEnvId)
            environmentRepo.create({
                id: newEnvId,
                projectId: newProject.id,
                name: env.name,
                sortOrder: env.sortOrder,
                strictRequired: env.strictRequired,
                createdAt: now,
            })
            for (const inst of instanceRepo.listByEnvironment(env.id)) {
                const newInstId = ID.instance()
                instMap.set(inst.id, newInstId)
                instanceRepo.create({ id: newInstId, environmentId: newEnvId, name: inst.name, createdAt: now })
            }
            // env-scope vars
            for (const row of envVarRepo.listEnvironmentScope(env.id)) {
                envVarRepo.insert({
                    ...row,
                    id: ID.envVar(),
                    projectId: newProject.id,
                    environmentId: newEnvId,
                    secretId: row.secretId ? secretMap.get(row.secretId) : undefined,
                    createdAt: now,
                    updatedAt: now,
                })
            }
        }
        // instance-scope vars (need both env + instance remapped)
        for (const env of environmentRepo.listByProject(srcId)) {
            const newEnvId = envMap.get(env.id)!
            for (const inst of instanceRepo.listByEnvironment(env.id)) {
                const newInstId = instMap.get(inst.id)!
                for (const row of envVarRepo.listInstanceScope(inst.id)) {
                    envVarRepo.insert({
                        ...row,
                        id: ID.envVar(),
                        projectId: newProject.id,
                        environmentId: newEnvId,
                        instanceId: newInstId,
                        secretId: row.secretId ? secretMap.get(row.secretId) : undefined,
                        createdAt: now,
                        updatedAt: now,
                    })
                }
            }
        }

        // flags + per-env values
        const flagMap = new Map<string, string>()
        for (const flag of featureFlagRepo.listFlags(srcId)) {
            const newFlagId = ID.flag()
            flagMap.set(flag.id, newFlagId)
            featureFlagRepo.insertFlag({ ...flag, id: newFlagId, projectId: newProject.id, createdAt: now })
        }
        for (const v of featureFlagRepo.listValuesByProject(srcId)) {
            const newFlagId = flagMap.get(v.flag_id)
            const newEnvId = envMap.get(v.environment_id)
            if (!newFlagId || !newEnvId) continue
            featureFlagRepo.upsertValue({
                id: ID.flagValue(),
                flagId: newFlagId,
                environmentId: newEnvId,
                enabled: v.enabled === 1,
                value: v.value,
                updatedAt: now,
            })
        }

        // notes
        for (const meta of noteRepo.listByProject(srcId)) {
            noteRepo.insert({
                id: ID.note(),
                projectId: newProject.id,
                title: meta.title,
                contentEnc: noteRepo.contentEnc(meta.id) ?? encrypt(''),
                createdBy,
                createdAt: now,
                updatedAt: now,
            })
        }

        return newProject
    })
}
