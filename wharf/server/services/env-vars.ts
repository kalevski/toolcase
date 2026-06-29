// Environment-variables service (planning §3.1 resolution cascade, §3.2 pending,
// §8.1 export, §10). The sole enforcer of the secret-hiding invariant on the
// server: developers never receive a real secret value. Composes the pure
// env-resolution + interpolate + env-file + env-export domain units with the
// env_var/secret repos and cipher.

import 'server-only'
import * as envVarRepo from '@/server/data/repositories/env-var-repo'
import type { EnvVarRow } from '@/server/data/repositories/env-var-repo'
import * as secretRepo from '@/server/data/repositories/secret-repo'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import { ID } from '@/server/infrastructure/ids'
import { resolveConfig, type EnvRow, type ResolveInput } from '@/server/domain/env-resolution'
import { InterpolationCycleError } from '@/server/domain/interpolate'
import { stringify as dotenvStringify } from '@/server/domain/env-file'
import { toJson, toCompose } from '@/server/domain/env-export'
import { isValidKey, type EnvVar, type EnvVarSource, type ResolvedConfig } from '@/server/domain/types'

export class EnvVarExistsError extends Error {}
export class EnvVarNotFoundError extends Error {}
export class SecretNotFoundError extends Error {}
export class InvalidKeyError extends Error {}
export class ScopeNotFoundError extends Error {}
export { InterpolationCycleError }

// ── helpers: scope validation + row -> domain mapping ─────────────────────────

function envInProject(projectId: string, environmentId: string) {
    const env = environmentRepo.byId(environmentId)
    return env && env.projectId === projectId ? env : undefined
}

function instanceInProject(projectId: string, instanceId: string) {
    const inst = instanceRepo.byId(instanceId)
    if (!inst) return undefined
    const env = environmentRepo.byId(inst.environmentId)
    return env && env.projectId === projectId ? { inst, env } : undefined
}

/** Decrypt a literal value + join the referenced secret's name for the editing view. */
function toEnvVar(row: EnvVarRow): EnvVar {
    return {
        id: row.id,
        projectId: row.projectId,
        environmentId: row.environmentId,
        instanceId: row.instanceId,
        key: row.key,
        source: row.source,
        value: row.source === 'literal' && row.valueEnc ? decrypt(row.valueEnc) : undefined,
        secretId: row.secretId,
        secretKey: row.source === 'secret_ref' && row.secretId ? secretRepo.byId(row.secretId)?.key : undefined,
        description: row.description,
        required: row.required,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

// ── editing views (raw scope lists) ───────────────────────────────────────────

export function listEnvironmentScope(projectId: string, environmentId: string): EnvVar[] {
    if (!envInProject(projectId, environmentId)) throw new ScopeNotFoundError()
    return envVarRepo.listEnvironmentScope(environmentId).map(toEnvVar)
}

export function listInstanceScope(projectId: string, instanceId: string): EnvVar[] {
    if (!instanceInProject(projectId, instanceId)) throw new ScopeNotFoundError()
    return envVarRepo.listInstanceScope(instanceId).map(toEnvVar)
}

// ── resolution (the cascade) ──────────────────────────────────────────────────

function buildEnvRows(rows: EnvVarRow[]): EnvRow[] {
    return rows.map((r) => ({
        key: r.key,
        source: r.source,
        value: r.source === 'literal' && r.valueEnc ? decrypt(r.valueEnc) : undefined,
        secretId: r.secretId,
        required: r.required,
        updatedAt: r.updatedAt,
    }))
}

/**
 * Resolve an instance's final environment (planning §3.1). `canReadSecrets` gates
 * whether real secret values are returned or masked as `<hidden:name>`.
 */
export function resolveInstance(
    projectId: string,
    instanceId: string,
    canReadSecrets: boolean,
): ResolvedConfig {
    const ctx = instanceInProject(projectId, instanceId)
    if (!ctx) throw new ScopeNotFoundError()
    const baselineRows = envVarRepo.listEnvironmentScope(ctx.env.id)
    const overrideRows = envVarRepo.listInstanceScope(instanceId)

    const secretIds = new Set<string>()
    for (const r of [...baselineRows, ...overrideRows]) {
        if (r.source === 'secret_ref' && r.secretId) secretIds.add(r.secretId)
    }
    const secretMeta: ResolveInput['secretMeta'] = {}
    const secretValues: Record<string, string> = {}
    for (const id of secretIds) {
        const meta = secretRepo.byId(id)
        if (meta) secretMeta[id] = { key: meta.key, updatedAt: meta.updatedAt }
        if (canReadSecrets) {
            const enc = secretRepo.valueEnc(id)
            if (enc) secretValues[id] = decrypt(enc)
        }
    }

    return resolveConfig({
        baseline: buildEnvRows(baselineRows),
        overrides: buildEnvRows(overrideRows),
        canReadSecrets,
        secretValues: canReadSecrets ? secretValues : undefined,
        secretMeta,
        lastFetchAt: ctx.inst.lastFetchAt,
    })
}

/** Resolve the environment baseline alone (no instance), e.g. for the baseline export. */
export function resolveBaseline(
    projectId: string,
    environmentId: string,
    canReadSecrets: boolean,
): ResolvedConfig {
    if (!envInProject(projectId, environmentId)) throw new ScopeNotFoundError()
    const baselineRows = envVarRepo.listEnvironmentScope(environmentId)
    const secretMeta: ResolveInput['secretMeta'] = {}
    const secretValues: Record<string, string> = {}
    for (const r of baselineRows) {
        if (r.source === 'secret_ref' && r.secretId) {
            const meta = secretRepo.byId(r.secretId)
            if (meta) secretMeta[r.secretId] = { key: meta.key, updatedAt: meta.updatedAt }
            if (canReadSecrets) {
                const enc = secretRepo.valueEnc(r.secretId)
                if (enc) secretValues[r.secretId] = decrypt(enc)
            }
        }
    }
    return resolveConfig({
        baseline: buildEnvRows(baselineRows),
        overrides: [],
        canReadSecrets,
        secretValues: canReadSecrets ? secretValues : undefined,
        secretMeta,
        lastFetchAt: undefined,
    })
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export interface EnvVarInput {
    environmentId: string
    instanceId?: string | null
    key: string
    source: EnvVarSource
    value?: string
    secretId?: string
    description?: string | null
    required?: boolean
}

export function createEnvVar(projectId: string, input: EnvVarInput): EnvVar {
    if (!isValidKey(input.key)) throw new InvalidKeyError()
    const env = envInProject(projectId, input.environmentId)
    if (!env) throw new ScopeNotFoundError()
    const instanceId = input.instanceId ?? null
    if (instanceId !== null && !instanceInProject(projectId, instanceId)) throw new ScopeNotFoundError()
    if (envVarRepo.byScopeAndKey(input.environmentId, instanceId, input.key)) throw new EnvVarExistsError()

    let valueEnc: string | undefined
    let secretId: string | undefined
    if (input.source === 'secret_ref') {
        if (!input.secretId) throw new SecretNotFoundError()
        const sec = secretRepo.byId(input.secretId)
        if (!sec || sec.projectId !== projectId) throw new SecretNotFoundError()
        secretId = input.secretId
    } else {
        valueEnc = encrypt(input.value ?? '')
    }

    const now = new Date().toISOString()
    const row: EnvVarRow = {
        id: ID.envVar(),
        projectId,
        environmentId: input.environmentId,
        instanceId: instanceId ?? undefined,
        key: input.key,
        source: input.source,
        valueEnc,
        secretId,
        description: input.description ?? undefined,
        // `required` is only meaningful on baseline rows.
        required: instanceId === null ? !!input.required : false,
        createdAt: now,
        updatedAt: now,
    }
    envVarRepo.insert(row)
    return toEnvVar(row)
}

export interface EnvVarPatch {
    value?: string
    source?: EnvVarSource
    secretId?: string
    description?: string | null
    required?: boolean
}

export function updateEnvVar(projectId: string, id: string, patch: EnvVarPatch): EnvVar {
    const row = envVarRepo.byId(id)
    if (!row || row.projectId !== projectId) throw new EnvVarNotFoundError()

    const fields: Parameters<typeof envVarRepo.update>[1] = { updatedAt: new Date().toISOString() }
    const nextSource = patch.source ?? row.source
    if (patch.source !== undefined) fields.source = patch.source

    if (nextSource === 'secret_ref') {
        const secretId = patch.secretId ?? row.secretId
        if (!secretId) throw new SecretNotFoundError()
        const sec = secretRepo.byId(secretId)
        if (!sec || sec.projectId !== projectId) throw new SecretNotFoundError()
        fields.secretId = secretId
        fields.valueEnc = null
    } else if (patch.value !== undefined || patch.source === 'literal') {
        fields.valueEnc = encrypt(patch.value ?? '')
        fields.secretId = null
    }

    if (patch.description !== undefined) fields.description = patch.description
    // required only applies to baseline rows.
    if (patch.required !== undefined && row.instanceId === undefined) fields.required = patch.required

    envVarRepo.update(id, fields)
    return toEnvVar(envVarRepo.byId(id)!)
}

export function deleteEnvVar(projectId: string, id: string): void {
    const row = envVarRepo.byId(id)
    if (!row || row.projectId !== projectId) throw new EnvVarNotFoundError()
    envVarRepo.remove(id)
}

// ── export (planning §8.1) ────────────────────────────────────────────────────

export type ExportFormat = 'dotenv' | 'json' | 'compose'

function render(entries: { key: string; value: string }[], format: ExportFormat): string {
    if (format === 'json') return toJson(entries)
    if (format === 'compose') return toCompose(entries)
    return dotenvStringify(entries)
}

export function exportInstance(
    projectId: string,
    instanceId: string,
    format: ExportFormat,
    canReadSecrets: boolean,
): string {
    const resolved = resolveInstance(projectId, instanceId, canReadSecrets)
    return render(
        resolved.env.map((e) => ({ key: e.key, value: e.value })),
        format,
    )
}

export function exportEnvironment(
    projectId: string,
    environmentId: string,
    format: ExportFormat,
    canReadSecrets: boolean,
): string {
    const resolved = resolveBaseline(projectId, environmentId, canReadSecrets)
    return render(
        resolved.env.map((e) => ({ key: e.key, value: e.value })),
        format,
    )
}

// ── bulk .env import (planning §8.1, decision #13) ────────────────────────────

import { tx } from '@/server/data/db'
import { parse as parseDotenv } from '@/server/domain/env-file'

export class BulkConflictError extends Error {
    constructor(readonly keys: string[]) {
        super('scope conflict')
    }
}

export interface ImportResult {
    created: number
    updated: number
    skipped: number
    rejected: { key: string; reason: string }[]
}

/**
 * Bulk-import a `.env` blob into one scope (planning §8.1). Values stay LITERAL by
 * default; a row whose value is `${secretName}` is promoted to a secret_ref only
 * when its key is listed in `promote` (decision #13 — per-row opt-in).
 */
export function importEnvVars(
    projectId: string,
    opts: {
        environmentId: string
        instanceId?: string | null
        text: string
        onConflict: 'skip' | 'overwrite'
        promote?: string[]
    },
): ImportResult {
    if (!envInProject(projectId, opts.environmentId)) throw new ScopeNotFoundError()
    const instanceId = opts.instanceId ?? null
    if (instanceId !== null && !instanceInProject(projectId, instanceId)) throw new ScopeNotFoundError()

    const promote = new Set(opts.promote ?? [])
    const entries = parseDotenv(opts.text)
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, rejected: [] }

    tx(() => {
        for (const { key, value } of entries) {
            if (!isValidKey(key)) {
                result.rejected.push({ key, reason: 'invalid key' })
                continue
            }
            // Optional per-row promotion of `${secretName}` to a secret_ref.
            let source: EnvVarSource = 'literal'
            let secretId: string | undefined
            const m = /^\$\{(.+)\}$/.exec(value.trim())
            if (m && promote.has(key)) {
                const sec = secretRepo.byKey(projectId, m[1])
                if (sec) {
                    source = 'secret_ref'
                    secretId = sec.id
                } else {
                    result.rejected.push({ key, reason: `no secret named ${m[1]}` })
                    continue
                }
            }

            const existing = envVarRepo.byScopeAndKey(opts.environmentId, instanceId, key)
            const now = new Date().toISOString()
            if (existing) {
                if (opts.onConflict !== 'overwrite') {
                    result.skipped++
                    continue
                }
                envVarRepo.update(existing.id, {
                    source,
                    valueEnc: source === 'literal' ? encrypt(value) : null,
                    secretId: source === 'secret_ref' ? secretId : null,
                    updatedAt: now,
                })
                result.updated++
            } else {
                envVarRepo.insert({
                    id: ID.envVar(),
                    projectId,
                    environmentId: opts.environmentId,
                    instanceId: instanceId ?? undefined,
                    key,
                    source,
                    valueEnc: source === 'literal' ? encrypt(value) : undefined,
                    secretId,
                    required: false,
                    createdAt: now,
                    updatedAt: now,
                })
                result.created++
            }
        }
    })
    return result
}

// ── bulk edit / multi-select (planning §8.4) ──────────────────────────────────

export type BulkAction = 'delete' | 'move' | 'copy'

export interface BulkResult {
    deleted?: number
    moved?: number
    copied?: number
}

/**
 * Apply a bulk action to selected env vars (planning §8.4). `move`/`copy` retarget
 * into another scope within the project; a UNIQUE(scope,key) collision aborts the
 * whole batch with a 409 listing the offending keys.
 */
export function bulkEnvVars(
    projectId: string,
    action: BulkAction,
    ids: string[],
    target?: { environmentId: string; instanceId?: string | null },
): BulkResult {
    const rows = ids.map((id) => envVarRepo.byId(id)).filter((r): r is EnvVarRow => !!r && r.projectId === projectId)

    if (action === 'delete') {
        return tx(() => {
            for (const r of rows) envVarRepo.remove(r.id)
            return { deleted: rows.length }
        })
    }

    if (!target) throw new ScopeNotFoundError()
    if (!envInProject(projectId, target.environmentId)) throw new ScopeNotFoundError()
    const targetInstance = target.instanceId ?? null
    if (targetInstance !== null && !instanceInProject(projectId, targetInstance)) throw new ScopeNotFoundError()

    // Pre-flight: every target key must be free (excluding the row itself on move).
    const conflicts: string[] = []
    for (const r of rows) {
        const clash = envVarRepo.byScopeAndKey(target.environmentId, targetInstance, r.key)
        if (clash && clash.id !== r.id) conflicts.push(r.key)
    }
    if (conflicts.length) throw new BulkConflictError(conflicts)

    return tx(() => {
        const now = new Date().toISOString()
        if (action === 'move') {
            for (const r of rows) envVarRepo.move(r.id, target.environmentId, targetInstance, now)
            return { moved: rows.length }
        }
        for (const r of rows) {
            envVarRepo.insert({
                ...r,
                id: ID.envVar(),
                environmentId: target.environmentId,
                instanceId: targetInstance ?? undefined,
                // `required` is baseline-only; a copy into an instance scope clears it.
                required: targetInstance === null ? r.required : false,
                createdAt: now,
                updatedAt: now,
            })
        }
        return { copied: rows.length }
    })
}
