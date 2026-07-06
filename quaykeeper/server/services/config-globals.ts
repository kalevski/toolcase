// Global-variable + secret service — the `/api/admin/global-vars` and
// `/api/admin/secrets` owner-only policy layer (move_wharf_to_perch.md §4, §8,
// §11 Phase 2). Errors are typed `ConfigGlobalError`s carrying an optional
// `data` payload (the referencing-instances list for a RESTRICT-delete 409);
// `httpErrorFor` maps them to the HTTP status + code a route returns.

import 'server-only'
import crypto from 'node:crypto'
import * as globalVarRepo from '@/server/data/repositories/global-var-repo'
import * as secretRepo from '@/server/data/repositories/secret-repo'
import * as envVarRepo from '@/server/data/repositories/env-var-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import { ID } from '@/server/infrastructure/ids'
import { isValidKey } from '@/server/domain/config-input'
import { generateSecret, bytesNeeded, type SecretGenSpec } from '@/server/domain/secret-gen'
import type { GlobalVar, ReferencingInstance, SecretGenKind, SecretMeta } from '@/server/domain/types'

export class ConfigGlobalError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
        public data?: { instances: ReferencingInstance[] },
    ) {
        super(message)
        this.name = 'ConfigGlobalError'
    }
}

export interface HttpError {
    status: number
    code: string
    data?: { instances: ReferencingInstance[] }
}

export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof ConfigGlobalError) return { status: err.status, code: err.code, data: err.data }
    return { status: 500, code: 'internal_error' }
}

interface Actor {
    githubId: number
    login: string
}

function audit(actor: Actor, action: string, detail?: string): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, detail })
}

function referencingInstances(instanceIds: string[]): ReferencingInstance[] {
    const seen = new Set<string>()
    const out: ReferencingInstance[] = []
    for (const id of instanceIds) {
        if (seen.has(id)) continue
        seen.add(id)
        const inst = instanceRepo.byId(id)
        if (inst) out.push({ id: inst.id, name: inst.name })
    }
    return out
}

// ── global variables ──────────────────────────────────────────────────────────

export function listGlobalVars(): GlobalVar[] {
    return globalVarRepo.list()
}

export function createGlobalVar(actor: Actor, body: { key: string; value: string; description?: string }): GlobalVar {
    const key = (body.key ?? '').trim()
    if (!isValidKey(key)) throw new ConfigGlobalError('invalid key', 'invalid_key', 400)
    if (globalVarRepo.byKey(key)) throw new ConfigGlobalError(`"${key}" already exists`, 'key_taken', 409)
    if (typeof body.value !== 'string') throw new ConfigGlobalError('"value" is required', 'invalid_request', 400)

    const now = new Date().toISOString()
    const row: GlobalVar = {
        id: ID.globalVar(),
        key,
        value: body.value,
        description: body.description?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
    }
    globalVarRepo.insert(row)
    audit(actor, 'global.create', key)
    return row
}

export function updateGlobalVar(
    actor: Actor,
    id: string,
    body: { value?: string; description?: string | null },
): GlobalVar {
    const existing = globalVarRepo.byId(id)
    if (!existing) throw new ConfigGlobalError('global variable not found', 'global_not_found', 404)
    globalVarRepo.update(id, {
        value: body.value,
        description: 'description' in body ? body.description ?? null : undefined,
        updatedAt: new Date().toISOString(),
    })
    audit(actor, 'global.update', existing.key)
    return globalVarRepo.byId(id)!
}

export function deleteGlobalVar(actor: Actor, id: string): void {
    const existing = globalVarRepo.byId(id)
    if (!existing) throw new ConfigGlobalError('global variable not found', 'global_not_found', 404)
    const refs = envVarRepo.listReferencingGlobal(id)
    if (refs.length) {
        const instances = referencingInstances(refs.map((r) => r.instanceId))
        throw new ConfigGlobalError(
            `referenced by ${instances.map((i) => i.name).join(', ')}`,
            'global_referenced',
            409,
            { instances },
        )
    }
    globalVarRepo.remove(id)
    audit(actor, 'global.delete', existing.key)
}

// ── secrets ───────────────────────────────────────────────────────────────────

export function listSecrets(): SecretMeta[] {
    return secretRepo.list()
}

export function createSecret(
    actor: Actor,
    body: { key: string; value: string; description?: string },
): SecretMeta {
    const key = (body.key ?? '').trim()
    if (!isValidKey(key)) throw new ConfigGlobalError('invalid key', 'invalid_key', 400)
    if (secretRepo.byKey(key)) throw new ConfigGlobalError(`"${key}" already exists`, 'key_taken', 409)
    if (typeof body.value !== 'string' || body.value === '') {
        throw new ConfigGlobalError('"value" is required', 'invalid_request', 400)
    }

    const now = new Date().toISOString()
    const id = ID.secret()
    secretRepo.insert({
        id,
        key,
        valueEnc: encrypt(body.value),
        description: body.description?.trim() || undefined,
        createdBy: actor.githubId,
        createdAt: now,
        updatedAt: now,
    })
    audit(actor, 'secret.create', key)
    return secretRepo.byId(id)!
}

export interface GenerateSecretRequest {
    key: string
    kind: SecretGenKind
    length?: number
    charset?: string
    description?: string
}

/** Generate + store a secret. The value is never returned — reveal afterwards (audited). */
export function generateSecretValue(actor: Actor, body: GenerateSecretRequest): SecretMeta {
    const key = (body.key ?? '').trim()
    if (!isValidKey(key)) throw new ConfigGlobalError('invalid key', 'invalid_key', 400)
    if (secretRepo.byKey(key)) throw new ConfigGlobalError(`"${key}" already exists`, 'key_taken', 409)
    if (body.charset !== undefined && body.charset.length < 2) {
        throw new ConfigGlobalError('custom charset must be at least 2 characters', 'invalid_charset', 400)
    }

    const length = Math.min(Math.max(Math.trunc(body.length ?? 32), 1), 4096)
    const spec: SecretGenSpec = { kind: body.kind, length, charset: body.charset }
    let value: string
    try {
        value = generateSecret(crypto.randomBytes(bytesNeeded(spec)), spec)
    } catch (err) {
        throw new ConfigGlobalError((err as Error).message, 'invalid_generate_spec', 400)
    }

    const now = new Date().toISOString()
    const id = ID.secret()
    secretRepo.insert({
        id,
        key,
        valueEnc: encrypt(value),
        description: body.description?.trim() || undefined,
        createdBy: actor.githubId,
        createdAt: now,
        updatedAt: now,
    })
    audit(actor, 'secret.generate', key)
    return secretRepo.byId(id)!
}

export function updateSecret(
    actor: Actor,
    id: string,
    body: { value?: string; description?: string | null },
): SecretMeta {
    const existing = secretRepo.byId(id)
    if (!existing) throw new ConfigGlobalError('secret not found', 'secret_not_found', 404)
    secretRepo.update(id, {
        valueEnc: body.value !== undefined ? encrypt(body.value) : undefined,
        description: 'description' in body ? body.description ?? null : undefined,
        updatedAt: new Date().toISOString(),
    })
    audit(actor, 'secret.update', existing.key)
    return secretRepo.byId(id)!
}

export function deleteSecret(actor: Actor, id: string): void {
    const existing = secretRepo.byId(id)
    if (!existing) throw new ConfigGlobalError('secret not found', 'secret_not_found', 404)
    const refs = envVarRepo.listReferencingSecret(id)
    if (refs.length) {
        const instances = referencingInstances(refs.map((r) => r.instanceId))
        throw new ConfigGlobalError(
            `referenced by ${instances.map((i) => i.name).join(', ')}`,
            'secret_referenced',
            409,
            { instances },
        )
    }
    secretRepo.remove(id)
    audit(actor, 'secret.delete', existing.key)
}

/** Audited reveal — the only path (besides the fetch API) to a secret's plaintext. */
export function revealSecret(actor: Actor, id: string): { value: string } {
    const existing = secretRepo.byId(id)
    const enc = existing ? secretRepo.valueEnc(id) : undefined
    if (!existing || !enc) throw new ConfigGlobalError('secret not found', 'secret_not_found', 404)
    audit(actor, 'secret.reveal', existing.key)
    return { value: decrypt(enc) }
}
