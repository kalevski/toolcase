// Docker-snippet service — the `/api/snippets` policy layer: CRUD over saved
// `docker run` recipes. Mirrors `services/instances.ts`: typed errors +
// `httpErrorFor`, audit entries per mutation. The spec is normalized + validated
// through the pure `domain/docker-run.ts` (the same module the client's live
// preview uses, so the server never accepts what the form wouldn't render).

import 'server-only'
import * as snippetRepo from '@/server/data/repositories/docker-snippet-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { ID } from '@/server/infrastructure/ids'
import { normalizeSpec, validateSpec, type DockerRunSpec } from '@/server/domain/docker-run'
import type { DockerSnippet } from '@/server/domain/types'

export class SnippetError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'SnippetError'
    }
}

export interface HttpError {
    status: number
    code: string
    message?: string
}

export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof SnippetError) return { status: err.status, code: err.code, message: err.message }
    return { status: 500, code: 'internal_error' }
}

interface Actor {
    githubId: number
    login: string
}

function audit(actor: Actor, action: string, detail?: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, detail, meta })
}

function found(id: string): DockerSnippet {
    const snip = snippetRepo.byId(id)
    if (!snip) throw new SnippetError('snippet not found', 'snippet_not_found', 404)
    return snip
}

/** Snippet name: free-text human label, 1–64 chars after trimming. */
export const SNIPPET_NAME_MAX = 64

function normalizedName(raw: unknown): string {
    if (typeof raw !== 'string' || raw.trim() === '') {
        throw new SnippetError('"name" is required', 'invalid_name', 400)
    }
    const name = raw.trim()
    if (name.length > SNIPPET_NAME_MAX) {
        throw new SnippetError(`name must be at most ${SNIPPET_NAME_MAX} characters`, 'invalid_name', 400)
    }
    return name
}

/** Resolve + verify the optional injection target. `null` = no injection. */
function normalizedInstanceId(raw: unknown): string | null {
    if (raw == null || raw === '') return null
    if (typeof raw !== 'string') throw new SnippetError('"instanceId" must be a string', 'invalid_instance', 400)
    if (!instanceRepo.byId(raw)) throw new SnippetError('injection instance not found', 'instance_not_found', 400)
    return raw
}

/** Normalize + validate a request-supplied spec against its injection target. */
function checkedSpec(raw: unknown, instanceId: string | null): DockerRunSpec {
    const spec = normalizeSpec(raw)
    // The spec's inject block and the row's instance travel together: an
    // instance without injection is inert, injection without an instance is
    // rejected by validateSpec below.
    const errors = validateSpec(spec, instanceId != null)
    if (errors.length) throw new SnippetError(errors.join(' '), 'invalid_spec', 400)
    if (!spec.inject && instanceId != null) {
        throw new SnippetError('an instance is set but injection is disabled in the spec', 'invalid_spec', 400)
    }
    return spec
}

// ── read ─────────────────────────────────────────────────────────────────────

export function listSnippets(): DockerSnippet[] {
    return snippetRepo.list()
}

export function getSnippet(id: string): DockerSnippet {
    return found(id)
}

// ── create / update / delete ─────────────────────────────────────────────────

export interface CreateSnippetRequest {
    name: string
    description?: string
    spec?: unknown
    /** Injection target instance id; empty/absent = plain docker run. */
    instanceId?: string | null
}

export function createSnippet(actor: Actor, body: CreateSnippetRequest): DockerSnippet {
    const name = normalizedName(body.name)
    if (snippetRepo.nameTaken(name)) throw new SnippetError(`"${name}" is already taken`, 'name_taken', 409)
    const instanceId = normalizedInstanceId(body.instanceId)
    const spec = checkedSpec(body.spec, instanceId)

    const id = ID.snippet()
    snippetRepo.create({
        id,
        name,
        description: typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
        spec,
        instanceId: instanceId ?? undefined,
        createdBy: actor.githubId,
        createdAt: new Date().toISOString(),
    })
    audit(actor, 'snippet.create', name, { image: spec.image, inject: spec.inject != null })
    return found(id)
}

export interface UpdateSnippetRequest {
    name?: string
    description?: string | null
    spec?: unknown
    /** `null`/'' clears the injection target; omit to leave unchanged. */
    instanceId?: string | null
}

export function updateSnippet(actor: Actor, id: string, body: UpdateSnippetRequest): DockerSnippet {
    const current = found(id)
    const fields: Parameters<typeof snippetRepo.update>[1] = { updatedAt: new Date().toISOString() }

    if (body.name !== undefined) {
        const name = normalizedName(body.name)
        if (snippetRepo.nameTaken(name, id)) throw new SnippetError(`"${name}" is already taken`, 'name_taken', 409)
        fields.name = name
    }
    if ('description' in body) fields.description = body.description?.trim() || null

    // The spec and its injection target are validated as a pair, so compute the
    // effective target first (request value, else the stored one).
    const instanceId = 'instanceId' in body ? normalizedInstanceId(body.instanceId) : current.instanceId ?? null
    if ('instanceId' in body) fields.instanceId = instanceId
    if (body.spec !== undefined) {
        fields.spec = checkedSpec(body.spec, instanceId)
    } else {
        const errors = validateSpec(current.spec, instanceId != null)
        if (errors.length) throw new SnippetError(errors.join(' '), 'invalid_spec', 400)
        if (!current.spec.inject && instanceId != null) {
            throw new SnippetError('an instance is set but injection is disabled in the spec', 'invalid_spec', 400)
        }
    }

    snippetRepo.update(id, fields)
    audit(actor, 'snippet.update', fields.name ?? current.name)
    return found(id)
}

export function deleteSnippet(actor: Actor, id: string): void {
    const snip = found(id)
    snippetRepo.remove(id)
    audit(actor, 'snippet.delete', snip.name)
}
