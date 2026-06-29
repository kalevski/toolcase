// Per-instance fetch-key service (planning §2.3, §5 auth, §11). One active key per
// instance (decision #8): mint/rotate overwrites; revoke nulls it. The raw secret
// is returned ONCE at mint/rotate and stored only as a SHA-256 hash. The Agent API
// authenticates a config fetch by timing-safe-comparing the bearer's hash.

import 'server-only'
import crypto from 'node:crypto'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as environmentRepo from '@/server/data/repositories/environment-repo'

export class InstanceNotFoundError extends Error {}

function sha256Hex(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex')
}

function instanceInProject(projectId: string, instanceId: string) {
    const inst = instanceRepo.byId(instanceId)
    if (!inst) return undefined
    const env = environmentRepo.byId(inst.environmentId)
    return env && env.projectId === projectId ? { inst, env } : undefined
}

/**
 * Mint (or rotate) the instance's fetch key. Returns the raw secret ONCE — it is
 * never recoverable, only re-rotatable. Rotation invalidates the old key
 * immediately (the running container 401s until its orchestrator secret is updated
 * AND it restarts — plan the window, gap-10).
 */
export function mintKey(projectId: string, instanceId: string, expiresAt?: string | null): string {
    if (!instanceInProject(projectId, instanceId)) throw new InstanceNotFoundError()
    const raw = crypto.randomBytes(32).toString('base64url')
    instanceRepo.setKey(instanceId, sha256Hex(raw), new Date().toISOString(), expiresAt ?? null)
    return raw
}

export function revokeKey(projectId: string, instanceId: string): void {
    if (!instanceInProject(projectId, instanceId)) throw new InstanceNotFoundError()
    instanceRepo.clearKey(instanceId)
}

// ── Agent-API authentication (not a route guard — used by the agent server) ────

export type InstanceAuth =
    | { ok: true; instanceId: string; environmentId: string; projectId: string; environmentName: string }
    | { ok: false; status: 401 | 404 }

/**
 * Authenticate an Agent-API request (planning §5): look up the instance, verify
 * its environment name matches the X-Wharf-Environment header (defense against a
 * misconfigured client), timing-safe-compare sha256(bearer) to the stored hash,
 * and enforce optional key expiry. Returns the resolved scope on success.
 */
export function authenticateInstance(
    instanceId: string | undefined,
    environmentName: string | undefined,
    bearer: string | undefined,
): InstanceAuth {
    if (!instanceId || !bearer) return { ok: false, status: 401 }
    const rec = instanceRepo.keyRecord(instanceId)
    if (!rec) return { ok: false, status: 404 }
    if (!rec.keyHash) return { ok: false, status: 401 }

    const env = environmentRepo.byId(rec.environmentId)
    if (!env) return { ok: false, status: 404 }
    if (environmentName && environmentName !== env.name) return { ok: false, status: 401 }

    if (rec.keyExpiresAt && rec.keyExpiresAt < new Date().toISOString()) return { ok: false, status: 401 }

    const got = Buffer.from(sha256Hex(bearer))
    const want = Buffer.from(rec.keyHash)
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
        return { ok: false, status: 401 }
    }
    return {
        ok: true,
        instanceId,
        environmentId: env.id,
        projectId: env.projectId,
        environmentName: env.name,
    }
}
