// Env-var + resolution + import/export service — the `/api/instances/{id}/vars`
// and `/config` and `/export` policy layer (move_wharf_to_perch.md §4, §8, §11
// Phase 2). Errors are typed `ConfigVarError`s; `httpErrorFor` maps them to the
// HTTP status + machine-readable code a route returns.

import 'server-only'
import * as envVarRepo from '@/server/data/repositories/env-var-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as globalVarRepo from '@/server/data/repositories/global-var-repo'
import * as secretRepo from '@/server/data/repositories/secret-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { decrypt } from '@/server/infrastructure/cipher'
import { ID } from '@/server/infrastructure/ids'
import { isValidKey } from '@/server/domain/config-input'
import { resolveConfig, type ResolvableEnvVar } from '@/server/domain/config-resolution'
import { stringify as stringifyDotenv } from '@/server/domain/env-file'
import { toJson } from '@/server/domain/env-export'
import type { EnvVar, EnvVarSource, ResolvedConfig } from '@/server/domain/types'

export class ConfigVarError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'ConfigVarError'
    }
}

export interface HttpError {
    status: number
    code: string
}

export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof ConfigVarError) return { status: err.status, code: err.code }
    return { status: 500, code: 'internal_error' }
}

interface Actor {
    githubId: number
    login: string
}

function audit(actor: Actor, action: string, instanceId: string, detail?: string): void {
    auditRepo.append({
        githubId: actor.githubId,
        login: actor.login,
        action,
        detail: detail ? `instance:${instanceId} ${detail}` : `instance:${instanceId}`,
    })
}

function ensureInstance(instanceId: string): void {
    if (!instanceRepo.byId(instanceId)) throw new ConfigVarError('instance not found', 'instance_not_found', 404)
}

function keyMap(ids: string[], lookup: (id: string) => { key: string } | undefined): Map<string, string> {
    const m = new Map<string, string>()
    for (const id of ids) {
        const row = lookup(id)
        if (row) m.set(id, row.key)
    }
    return m
}

// ── read (joined for display) ────────────────────────────────────────────────

function toEnvVar(
    row: envVarRepo.EnvVarRow,
    globalKeys: Map<string, string>,
    secretKeys: Map<string, string>,
): EnvVar {
    return {
        id: row.id,
        instanceId: row.instanceId,
        key: row.key,
        source: row.source,
        value: row.source === 'literal' ? row.value : undefined,
        globalVarId: row.globalVarId,
        globalVarKey: row.globalVarId ? globalKeys.get(row.globalVarId) : undefined,
        secretId: row.secretId,
        secretKey: row.secretId ? secretKeys.get(row.secretId) : undefined,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

export function listVars(instanceId: string): EnvVar[] {
    ensureInstance(instanceId)
    const rows = envVarRepo.listByInstance(instanceId)
    const globalIds = [...new Set(rows.flatMap((r) => (r.globalVarId ? [r.globalVarId] : [])))]
    const secretIds = [...new Set(rows.flatMap((r) => (r.secretId ? [r.secretId] : [])))]
    const globalKeys = keyMap(globalIds, globalVarRepo.byId)
    const secretKeys = keyMap(secretIds, secretRepo.byId)
    return rows.map((r) => toEnvVar(r, globalKeys, secretKeys))
}

// ── create / update / delete ─────────────────────────────────────────────────

export interface VarSourcePayload {
    source: EnvVarSource
    value?: string
    globalVarId?: string
    secretId?: string
}

/** Validate a source payload against its referenced entity; returns the CHECK-satisfying triple. */
function resolveSourcePayload(
    body: VarSourcePayload,
): { value?: string; globalVarId?: string; secretId?: string } {
    if (body.source === 'literal') {
        if (typeof body.value !== 'string') {
            throw new ConfigVarError('literal source requires "value"', 'invalid_request', 400)
        }
        return { value: body.value }
    }
    if (body.source === 'global') {
        if (!body.globalVarId || !globalVarRepo.byId(body.globalVarId)) {
            throw new ConfigVarError('unknown global variable', 'unknown_global', 400)
        }
        return { globalVarId: body.globalVarId }
    }
    if (body.source === 'secret') {
        if (!body.secretId || !secretRepo.byId(body.secretId)) {
            throw new ConfigVarError('unknown secret', 'unknown_secret', 400)
        }
        return { secretId: body.secretId }
    }
    throw new ConfigVarError('source must be literal, global, or secret', 'invalid_request', 400)
}

export interface CreateVarRequest extends VarSourcePayload {
    key: string
    description?: string
}

export function createVar(actor: Actor, instanceId: string, body: CreateVarRequest): EnvVar {
    ensureInstance(instanceId)
    const key = (body.key ?? '').trim()
    if (!isValidKey(key)) throw new ConfigVarError('invalid key', 'invalid_key', 400)
    if (envVarRepo.byInstanceAndKey(instanceId, key)) {
        throw new ConfigVarError(`"${key}" already exists on this instance`, 'key_taken', 409)
    }
    const resolved = resolveSourcePayload(body)
    const now = new Date().toISOString()
    const id = ID.envVar()
    envVarRepo.insert({
        id,
        instanceId,
        key,
        source: body.source,
        value: resolved.value,
        globalVarId: resolved.globalVarId,
        secretId: resolved.secretId,
        description: body.description?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
    })
    audit(actor, 'env.create', instanceId, key)
    return listVars(instanceId).find((v) => v.id === id)!
}

export interface UpdateVarRequest {
    source?: EnvVarSource
    value?: string
    globalVarId?: string
    secretId?: string
    description?: string | null
}

export function updateVar(actor: Actor, instanceId: string, varId: string, body: UpdateVarRequest): EnvVar {
    ensureInstance(instanceId)
    const row = envVarRepo.byId(varId)
    if (!row || row.instanceId !== instanceId) throw new ConfigVarError('env var not found', 'var_not_found', 404)
    const now = new Date().toISOString()

    if (body.source !== undefined) {
        const resolved = resolveSourcePayload({
            source: body.source,
            value: body.value,
            globalVarId: body.globalVarId,
            secretId: body.secretId,
        })
        envVarRepo.update(varId, {
            source: body.source,
            value: resolved.value ?? null,
            globalVarId: resolved.globalVarId ?? null,
            secretId: resolved.secretId ?? null,
            updatedAt: now,
        })
    }
    if (body.description !== undefined) {
        envVarRepo.update(varId, { description: body.description?.trim() || null, updatedAt: now })
    }
    audit(actor, 'env.update', instanceId, row.key)
    return listVars(instanceId).find((v) => v.id === varId)!
}

export function deleteVar(actor: Actor, instanceId: string, varId: string): void {
    ensureInstance(instanceId)
    const row = envVarRepo.byId(varId)
    if (!row || row.instanceId !== instanceId) throw new ConfigVarError('env var not found', 'var_not_found', 404)
    envVarRepo.remove(varId)
    audit(actor, 'env.delete', instanceId, row.key)
}

// ── import (move_wharf_to_perch.md §4) ───────────────────────────────────────
//
// The client parses the .env blob itself (env-file.ts is pure/isomorphic) and
// builds a preview letting the user re-point selected keys at an existing
// global/secret; this only persists the resolved entries.

export interface ImportEntry extends VarSourcePayload {
    key: string
}

export interface ImportResult {
    created: number
    skipped: string[]
}

export function importVars(actor: Actor, instanceId: string, entries: ImportEntry[]): ImportResult {
    ensureInstance(instanceId)
    const now = new Date().toISOString()
    let created = 0
    const skipped: string[] = []
    for (const entry of entries) {
        const key = (entry.key ?? '').trim()
        if (!isValidKey(key) || envVarRepo.byInstanceAndKey(instanceId, key)) {
            skipped.push(key || '(empty)')
            continue
        }
        let resolved: { value?: string; globalVarId?: string; secretId?: string }
        try {
            resolved = resolveSourcePayload(entry)
        } catch {
            skipped.push(key)
            continue
        }
        envVarRepo.insert({
            id: ID.envVar(),
            instanceId,
            key,
            source: entry.source,
            ...resolved,
            createdAt: now,
            updatedAt: now,
        })
        created++
    }
    audit(actor, 'env.import', instanceId, `${created} created, ${skipped.length} skipped`)
    return { created, skipped }
}

// ── resolution + export (move_wharf_to_perch.md §4) ──────────────────────────

function buildGlobalsMap(ids: string[]): Map<string, { value: string; updatedAt: string }> {
    const m = new Map<string, { value: string; updatedAt: string }>()
    for (const id of ids) {
        const g = globalVarRepo.byId(id)
        if (g) m.set(id, { value: g.value, updatedAt: g.updatedAt })
    }
    return m
}

function buildSecretsMap(ids: string[]): Map<string, { key: string; updatedAt: string }> {
    const m = new Map<string, { key: string; updatedAt: string }>()
    for (const id of ids) {
        const s = secretRepo.byId(id)
        if (s) m.set(id, { key: s.key, updatedAt: s.updatedAt })
    }
    return m
}

export function resolveInstance(instanceId: string, canReadSecrets: boolean): ResolvedConfig {
    const inst = instanceRepo.byId(instanceId)
    if (!inst) throw new ConfigVarError('instance not found', 'instance_not_found', 404)

    const rows = envVarRepo.listByInstance(instanceId)
    const globalIds = [...new Set(rows.flatMap((r) => (r.globalVarId ? [r.globalVarId] : [])))]
    const secretIds = [...new Set(rows.flatMap((r) => (r.secretId ? [r.secretId] : [])))]
    const globalsById = buildGlobalsMap(globalIds)
    const secretsById = buildSecretsMap(secretIds)

    const secretValuesById = new Map<string, string>()
    if (canReadSecrets) {
        for (const id of secretIds) {
            const enc = secretRepo.valueEnc(id)
            if (enc) secretValuesById.set(id, decrypt(enc))
        }
    }

    const resolvable: ResolvableEnvVar[] = rows.map((r) => ({
        key: r.key,
        source: r.source,
        value: r.value,
        globalVarId: r.globalVarId,
        secretId: r.secretId,
        updatedAt: r.updatedAt,
    }))
    return resolveConfig(resolvable, globalsById, secretsById, secretValuesById, canReadSecrets, inst.lastFetchAt)
}

export type ExportFormat = 'dotenv' | 'json'

export function exportInstance(instanceId: string, format: ExportFormat, canReadSecrets: boolean): string {
    const resolved = resolveInstance(instanceId, canReadSecrets)
    const entries = resolved.env.map((e) => ({ key: e.key, value: e.value }))
    return format === 'json' ? toJson(entries) : stringifyDotenv(entries)
}
