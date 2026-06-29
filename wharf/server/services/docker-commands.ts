// Docker-run command builder service (planning §7, §9). Owner/devops only. The
// app only GENERATES command text via the pure renderer — it never executes
// Docker. CRUD over saved DockerSpecs + a render that resolves the owning
// instance (for 'wharf'/'instance' env injection) before delegating to
// buildDockerCommand. 'instance' env resolution needs the env-vars resolver
// (a later phase) so it throws a typed error the route maps to 422.

import 'server-only'
import * as dockerCommandRepo from '@/server/data/repositories/docker-command-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import { ID } from '@/server/infrastructure/ids'
import { buildDockerCommand, type RenderOpts } from '@/server/domain/docker-command'
import type {
    DockerCommand,
    DockerSpec,
    DockerLifecycle,
    DockerRenderFormat,
} from '@/server/domain/types'

export class DockerCommandExistsError extends Error {}
export class DockerCommandNotFoundError extends Error {}
/** envSource 'instance' needs the env-vars resolver (later phase) → route maps to 422. */
export class InstanceEnvUnavailableError extends Error {}
/** A persisted/incoming DockerSpec failed server-side validation (wharf S2) → route maps to 400. */
export class DockerSpecInvalidError extends Error {}

const RESTART_VALUES: ReadonlySet<string> = new Set([
    'no',
    'on-failure',
    'always',
    'unless-stopped',
])
const PULL_VALUES: ReadonlySet<string> = new Set(['missing', 'always', 'never'])
const ENV_SOURCE_VALUES: ReadonlySet<string> = new Set(['none', 'wharf', 'instance'])

function isPort(n: unknown): n is number {
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 65535
}

/**
 * Validate an incoming DockerSpec before persisting (wharf S2). The renderer
 * `shEscape`s most string fields, but a few are interpolated raw into the
 * generated `docker run` text that a devops later copies into a shell — so the
 * fields that bypass escaping (`restart`, `protocol`, the numeric ports) must be
 * proven safe here. Throws DockerSpecInvalidError on any violation.
 *
 * NOTE on `extraArgs`: it is a deliberate raw shell escape-hatch (free-form flags
 * such as `--cap-add NET_ADMIN`); it is rendered unescaped by design and is the
 * devops author's own responsibility — see docker-command.ts.
 */
function validateSpec(spec: DockerSpec): void {
    if (!spec || typeof spec !== 'object') throw new DockerSpecInvalidError('spec required')
    if (!RESTART_VALUES.has(spec.restart)) {
        throw new DockerSpecInvalidError('invalid restart policy')
    }
    if (!PULL_VALUES.has(spec.pull)) throw new DockerSpecInvalidError('invalid pull policy')
    if (!ENV_SOURCE_VALUES.has(spec.envSource)) {
        throw new DockerSpecInvalidError('invalid envSource')
    }
    if (!Array.isArray(spec.ports)) throw new DockerSpecInvalidError('ports must be an array')
    for (const p of spec.ports) {
        if (!isPort(p.host) || !isPort(p.container)) {
            throw new DockerSpecInvalidError('port must be an integer in 0–65535')
        }
        if (p.protocol !== 'tcp' && p.protocol !== 'udp') {
            throw new DockerSpecInvalidError('invalid port protocol')
        }
    }
    if (!Array.isArray(spec.volumes)) throw new DockerSpecInvalidError('volumes must be an array')
    for (const v of spec.volumes) {
        if (v.mode !== 'rw' && v.mode !== 'ro') throw new DockerSpecInvalidError('invalid volume mode')
    }
}

/** Sensible default spec for a fresh builder form (planning §7.1). */
export function defaultDockerSpec(): DockerSpec {
    return {
        image: '',
        tag: '',
        containerName: '',
        detach: true,
        tty: false,
        removeOnExit: false,
        pull: 'missing',
        restart: 'unless-stopped',
        network: undefined,
        ports: [],
        volumes: [],
        envInline: [],
        envSource: 'none',
        labels: [],
        memory: undefined,
        cpus: undefined,
        user: undefined,
        workdir: undefined,
        entrypoint: null,
        command: [],
        extraArgs: undefined,
    }
}

export function listCommands(projectId: string): DockerCommand[] {
    return dockerCommandRepo.listByProject(projectId)
}

function getCommand(projectId: string, cmdId: string): DockerCommand | undefined {
    const cmd = dockerCommandRepo.byId(cmdId)
    if (!cmd || cmd.projectId !== projectId) return undefined
    return cmd
}

export function createCommand(
    projectId: string,
    fields: { name: string; spec: DockerSpec; instanceId?: string },
    createdBy: number,
): DockerCommand {
    const name = fields.name.trim()
    if (!name) throw new Error('name required')
    validateSpec(fields.spec)
    if (dockerCommandRepo.byName(projectId, name)) throw new DockerCommandExistsError()
    const now = new Date().toISOString()
    const cmd: DockerCommand = {
        id: ID.dockerCommand(),
        projectId,
        name,
        spec: fields.spec,
        instanceId: fields.instanceId,
        createdBy,
        createdAt: now,
        updatedAt: now,
    }
    dockerCommandRepo.insert(cmd)
    return cmd
}

export function updateCommand(
    projectId: string,
    cmdId: string,
    fields: { name?: string; spec?: DockerSpec; instanceId?: string | null },
): DockerCommand {
    const cmd = getCommand(projectId, cmdId)
    if (!cmd) throw new DockerCommandNotFoundError()
    if (fields.spec !== undefined) validateSpec(fields.spec)
    let name = cmd.name
    if (fields.name !== undefined) {
        name = fields.name.trim()
        if (!name) throw new Error('name required')
        const clash = dockerCommandRepo.byName(projectId, name)
        if (clash && clash.id !== cmdId) throw new DockerCommandExistsError()
    }
    const updatedAt = new Date().toISOString()
    dockerCommandRepo.update(cmdId, {
        name: fields.name !== undefined ? name : undefined,
        specJson: fields.spec !== undefined ? JSON.stringify(fields.spec) : undefined,
        instanceId: fields.instanceId,
        updatedAt,
    })
    return {
        ...cmd,
        name,
        spec: fields.spec ?? cmd.spec,
        instanceId:
            fields.instanceId === undefined
                ? cmd.instanceId
                : (fields.instanceId ?? undefined),
        updatedAt,
    }
}

export function deleteCommand(projectId: string, cmdId: string): void {
    const cmd = getCommand(projectId, cmdId)
    if (!cmd) throw new DockerCommandNotFoundError()
    dockerCommandRepo.remove(cmdId)
}

/**
 * Render a saved command's spec to text (planning §7.2/§7.3). For envSource
 * 'wharf'/'instance' the spec needs its owning instance (verified to belong to
 * the project) so the renderer can inject WHARF_* / resolved env. 'instance'
 * needs the real resolved env (later phase) → throws InstanceEnvUnavailableError.
 */
export function renderCommand(
    projectId: string,
    cmdId: string,
    opts: { lifecycle: DockerLifecycle; format: DockerRenderFormat },
): string {
    const cmd = getCommand(projectId, cmdId)
    if (!cmd) throw new DockerCommandNotFoundError()

    const renderOpts: RenderOpts = {
        lifecycle: opts.lifecycle,
        format: opts.format,
    }

    if (cmd.spec.envSource === 'wharf' || cmd.spec.envSource === 'instance') {
        if (!cmd.instanceId) {
            throw new Error(`envSource ${cmd.spec.envSource} requires an instance`)
        }
        const instance = instanceRepo.byId(cmd.instanceId)
        if (!instance) throw new DockerCommandNotFoundError()
        const environment = environmentRepo.byId(instance.environmentId)
        if (!environment || environment.projectId !== projectId) {
            throw new DockerCommandNotFoundError()
        }
        renderOpts.instance = { id: instance.id, environmentName: environment.name }

        if (cmd.spec.envSource === 'instance') {
            // Real env injection needs the env-vars resolver (a later phase).
            throw new InstanceEnvUnavailableError()
        }
    }

    return buildDockerCommand(cmd.spec, renderOpts)
}
