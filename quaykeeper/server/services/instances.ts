// Instance management service — the `/api/instances` policy layer
// (move_wharf_to_perch.md §8, §11 Phase 2): CRUD, tags, clone, and fetch-key
// mint/rotate/revoke. Errors are typed `InstanceError`s; `httpErrorFor` maps
// them to the HTTP status + machine-readable code a route returns.

import 'server-only'
import crypto from 'node:crypto'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as envVarRepo from '@/server/data/repositories/env-var-repo'
import * as flagRepo from '@/server/data/repositories/flag-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { tx } from '@/server/data/db'
import { ID } from '@/server/infrastructure/ids'
import { isValidInstanceName, isValidProject, normalizeTags } from '@/server/domain/config-input'
import type { Instance, InstanceListItem } from '@/server/domain/types'

export class InstanceError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'InstanceError'
    }
}

export interface HttpError {
    status: number
    code: string
}

export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof InstanceError) return { status: err.status, code: err.code }
    return { status: 500, code: 'internal_error' }
}

interface Actor {
    githubId: number
    login: string
}

function audit(actor: Actor, action: string, detail?: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, detail, meta })
}

function found(id: string): Instance {
    const inst = instanceRepo.byId(id)
    if (!inst) throw new InstanceError('instance not found', 'instance_not_found', 404)
    return inst
}

function normalizedName(raw: unknown): string {
    if (typeof raw !== 'string') throw new InstanceError('"name" is required', 'invalid_name', 400)
    const name = raw.trim().toLowerCase()
    if (!isValidInstanceName(name)) {
        throw new InstanceError(
            'instance name must be lowercase letters/digits/hyphens, no leading/trailing hyphen',
            'invalid_name',
            400,
        )
    }
    return name
}

/** Normalize an optional project label: trim/lowercase; empty clears (null). */
function normalizedProject(raw: unknown): string | null {
    if (raw == null) return null
    if (typeof raw !== 'string') throw new InstanceError('"project" must be a string', 'invalid_project', 400)
    const project = raw.trim().toLowerCase()
    if (project === '') return null
    if (!isValidProject(project)) {
        throw new InstanceError(
            'project must be lowercase letters/digits/hyphens/underscores, max 32 chars',
            'invalid_project',
            400,
        )
    }
    return project
}

// ── read ─────────────────────────────────────────────────────────────────────

/** All instances, optionally filtered to one tag (§8 `?tag=`). */
export function listInstances(tag?: string): InstanceListItem[] {
    const pendingIds = envVarRepo.pendingInstanceIds()
    return instanceRepo.list(tag).map((inst) => ({ ...inst, pending: pendingIds.has(inst.id) }))
}

export function getInstance(id: string): Instance {
    return found(id)
}

// ── create / update / delete ─────────────────────────────────────────────────

export interface CreateInstanceRequest {
    name: string
    description?: string
    /** Optional project label — grouping/filter only. */
    project?: string | null
    tags?: unknown
}

export function createInstance(actor: Actor, body: CreateInstanceRequest): Instance {
    const name = normalizedName(body.name)
    if (instanceRepo.nameTaken(name)) {
        throw new InstanceError(`"${name}" is already taken`, 'name_taken', 409)
    }
    const project = normalizedProject(body.project)
    const tagsResult = normalizeTags(body.tags)
    if (!tagsResult.ok) throw new InstanceError(`invalid tag "${tagsResult.invalid}"`, 'invalid_tag', 400)

    const id = ID.instance()
    const now = new Date().toISOString()
    tx(() => {
        instanceRepo.create({
            id,
            name,
            description: body.description?.trim() || undefined,
            project: project ?? undefined,
            createdAt: now,
        })
        if (tagsResult.tags.length) instanceRepo.replaceTags(id, tagsResult.tags)
    })
    audit(actor, 'instance.create', name)
    return found(id)
}

export interface UpdateInstanceRequest {
    name?: string
    description?: string | null
    /** Optional project label — empty/null clears it. Omit to leave unchanged. */
    project?: string | null
    /** Replace-set array (§8) — omit to leave tags unchanged. */
    tags?: unknown
}

export function updateInstance(actor: Actor, id: string, body: UpdateInstanceRequest): Instance {
    const inst = found(id)
    const fields: { name?: string; description?: string | null; project?: string | null; updatedAt: string } = {
        updatedAt: new Date().toISOString(),
    }
    if (body.name !== undefined) {
        const name = normalizedName(body.name)
        if (instanceRepo.nameTaken(name, id)) throw new InstanceError(`"${name}" is already taken`, 'name_taken', 409)
        fields.name = name
    }
    if ('description' in body) fields.description = body.description?.trim() || null
    if ('project' in body) fields.project = normalizedProject(body.project)

    let tags: string[] | undefined
    if (body.tags !== undefined) {
        const result = normalizeTags(body.tags)
        if (!result.ok) throw new InstanceError(`invalid tag "${result.invalid}"`, 'invalid_tag', 400)
        tags = result.tags
    }

    tx(() => {
        instanceRepo.update(id, fields)
        if (tags) instanceRepo.replaceTags(id, tags)
    })
    audit(actor, 'instance.update', fields.name ?? inst.name)
    return found(id)
}

export function deleteInstance(actor: Actor, id: string): void {
    const inst = found(id)
    instanceRepo.remove(id)
    audit(actor, 'instance.delete', inst.name)
}

// ── clone (move_wharf_to_perch.md §6) ────────────────────────────────────────

/**
 * Deep-copy an instance: tags verbatim, env vars (references point at the SAME
 * global entities — globals are shared by design), flags with their enabled
 * state. The fetch key is never copied (mints its own). One transaction.
 */
export function cloneInstance(actor: Actor, srcId: string, newName: string): Instance {
    const src = found(srcId)
    const name = normalizedName(newName)
    if (instanceRepo.nameTaken(name)) throw new InstanceError(`"${name}" is already taken`, 'name_taken', 409)

    const clonedId = ID.instance()
    const now = new Date().toISOString()
    let varCount = 0
    let flagCount = 0
    tx(() => {
        instanceRepo.create({ id: clonedId, name, description: src.description, project: src.project, createdAt: now })
        if (src.tags.length) instanceRepo.replaceTags(clonedId, src.tags)
        for (const v of envVarRepo.listByInstance(srcId)) {
            envVarRepo.insert({
                id: ID.envVar(),
                instanceId: clonedId,
                key: v.key,
                source: v.source,
                value: v.value,
                globalVarId: v.globalVarId,
                secretId: v.secretId,
                description: v.description,
                createdAt: now,
                updatedAt: now,
            })
            varCount++
        }
        for (const f of flagRepo.listByInstance(srcId)) {
            flagRepo.insert({
                id: ID.flag(),
                instanceId: clonedId,
                key: f.key,
                enabled: f.enabled,
                description: f.description,
                createdAt: now,
                updatedAt: now,
            })
            flagCount++
        }
    })
    audit(actor, 'instance.clone', `from:${srcId}`, {
        source: srcId,
        vars: varCount,
        flags: flagCount,
        tags: src.tags.length,
    })
    return found(clonedId)
}

// ── fetch keys (move_wharf_to_perch.md §9) ───────────────────────────────────

function sha256Hex(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex')
}

/** Mint (or rotate) the instance's fetch key. Returns the raw secret ONCE. */
export function mintKey(actor: Actor, id: string, expiresAt?: string | null): string {
    const inst = found(id)
    const raw = crypto.randomBytes(32).toString('base64url')
    const now = new Date().toISOString()
    instanceRepo.setKey(id, sha256Hex(raw), now, expiresAt ?? null)
    audit(actor, 'instance.key.mint', inst.name)
    return raw
}

export function revokeKey(actor: Actor, id: string): void {
    const inst = found(id)
    instanceRepo.clearKey(id, new Date().toISOString())
    audit(actor, 'instance.key.revoke', inst.name)
}

// ── fetch-API authentication (move_wharf_to_perch.md §9 — used by the agent server's /v1/*) ──

export type InstanceAuth = { ok: true; instanceId: string } | { ok: false; status: 401 | 404 }

/** Verify `X-Quaykeeper-Instance` + bearer secret; timing-safe, checks expiry. */
export function authenticateInstance(name: string | undefined, bearer: string | undefined): InstanceAuth {
    if (!name || !bearer) return { ok: false, status: 401 }
    const inst = instanceRepo.byName(name)
    if (!inst) return { ok: false, status: 404 }
    const rec = instanceRepo.keyRecord(inst.id)
    if (!rec?.keyHash) return { ok: false, status: 401 }
    if (rec.keyExpiresAt && rec.keyExpiresAt < new Date().toISOString()) return { ok: false, status: 401 }

    const got = Buffer.from(sha256Hex(bearer))
    const want = Buffer.from(rec.keyHash)
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
        return { ok: false, status: 401 }
    }
    return { ok: true, instanceId: inst.id }
}
