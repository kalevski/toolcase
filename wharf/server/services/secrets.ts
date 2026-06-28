// Secrets service (planning §2.3/§2.4 secret-hiding invariant, §8.2, §11).
// Project-level, devops-only VALUES. The route layer gates by project role:
// developers may list KEYS only (listSecrets returns keys-only metadata and is the
// ONLY thing a developer ever receives); every value-bearing operation here is
// reachable only behind a guardProject('devops') route. This module is the single
// place that touches the cipher / generated entropy and it NEVER returns a
// plaintext value on a create/update/generate path — only the dedicated, audited
// `revealSecret` returns plaintext.

import 'server-only'
import * as secretRepo from '@/server/data/repositories/secret-repo'
import * as projectRepo from '@/server/data/repositories/project-repo'
import { ID } from '@/server/infrastructure/ids'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import { generateSecret, bytesNeeded, type SecretGenSpec } from '@/server/domain/secret-gen'
import { isValidKey, type SecretMeta, type SecretGenKind } from '@/server/domain/types'
import crypto from 'node:crypto'

export class SecretExistsError extends Error {}
export class SecretNotFoundError extends Error {}
export class SecretReferencedError extends Error {}
export class ProjectNotFoundError extends Error {}
export class InvalidKeyError extends Error {}

/** Project-scoped lookup: resolves the secret only when it belongs to `projectId`. */
function scoped(projectId: string, id: string): SecretMeta {
    const meta = secretRepo.byId(id)
    if (!meta || meta.projectId !== projectId) throw new SecretNotFoundError()
    return meta
}

/** Keys-only list. Safe to return to developers (no values, ever). */
export function listSecrets(projectId: string): SecretMeta[] {
    return secretRepo.listByProject(projectId)
}

export function createSecret(
    projectId: string,
    input: { key: string; value: string; description?: string },
    createdBy: number,
): SecretMeta {
    if (!projectRepo.byId(projectId)) throw new ProjectNotFoundError()
    const key = input.key.trim()
    if (!isValidKey(key)) throw new InvalidKeyError()
    if (secretRepo.byKey(projectId, key)) throw new SecretExistsError()
    const now = new Date().toISOString()
    const id = ID.secret()
    secretRepo.insert({
        id,
        projectId,
        key,
        valueEnc: encrypt(input.value),
        description: input.description?.trim() || undefined,
        createdBy,
        createdAt: now,
        updatedAt: now,
    })
    // Return keys-only metadata — the value never travels back out.
    return {
        id,
        projectId,
        key,
        description: input.description?.trim() || undefined,
        createdBy,
        createdAt: now,
        updatedAt: now,
    }
}

export function updateSecret(
    projectId: string,
    id: string,
    fields: { value?: string; description?: string },
): SecretMeta {
    const meta = scoped(projectId, id)
    const now = new Date().toISOString()
    secretRepo.update(id, {
        valueEnc: fields.value !== undefined ? encrypt(fields.value) : undefined,
        description: fields.description !== undefined ? fields.description.trim() : undefined,
        updatedAt: now,
    })
    return {
        ...meta,
        description:
            fields.description !== undefined
                ? fields.description.trim() || undefined
                : meta.description,
        updatedAt: now,
    }
}

export function deleteSecret(projectId: string, id: string): void {
    scoped(projectId, id)
    try {
        secretRepo.remove(id)
    } catch (e) {
        // env_var.secret_id is ON DELETE RESTRICT: SQLite rejects the delete while a
        // referencing env var exists. Surface as a typed 409 at the route layer.
        if (e instanceof Error && /FOREIGN KEY constraint failed/i.test(e.message)) {
            throw new SecretReferencedError()
        }
        throw e
    }
}

/** Audited plaintext reveal (route audits 'secret.reveal'). Devops-only. */
export function revealSecret(projectId: string, id: string): string {
    scoped(projectId, id)
    const enc = secretRepo.valueEnc(id)
    if (enc === undefined) throw new SecretNotFoundError()
    return decrypt(enc)
}

export function generateSecret_(
    projectId: string,
    input: { key: string; kind: SecretGenKind; length: number; charset?: string },
    createdBy: number,
): SecretMeta {
    if (!projectRepo.byId(projectId)) throw new ProjectNotFoundError()
    const key = input.key.trim()
    if (!isValidKey(key)) throw new InvalidKeyError()
    if (secretRepo.byKey(projectId, key)) throw new SecretExistsError()

    const spec: SecretGenSpec = { kind: input.kind, length: input.length, charset: input.charset }
    const bytes = crypto.randomBytes(bytesNeeded(spec))
    const value = generateSecret(bytes, spec)

    const now = new Date().toISOString()
    const id = ID.secret()
    secretRepo.insert({
        id,
        projectId,
        key,
        valueEnc: encrypt(value),
        createdBy,
        createdAt: now,
        updatedAt: now,
    })
    // NEVER return the generated value in the response — keys-only metadata.
    return {
        id,
        projectId,
        key,
        createdBy,
        createdAt: now,
        updatedAt: now,
    }
}
