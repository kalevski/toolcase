// Machine-facing instance fetch service (move_wharf_to_perch.md §9). Wharf ran
// a second cookieless `node:http` listener on `AGENT_PORT`; here it's a normal
// Next.js route on perch's single port — no dual-port process, no separate
// listener lifecycle. Cookieless, read-only, instance-key authenticated.

import 'server-only'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import * as instances from '@/server/services/instances'
import * as configVars from '@/server/services/config-vars'
import * as flagRepo from '@/server/data/repositories/flag-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'

/** Deterministic JSON stringify (sorted object keys) for a stable ETag. */
function canonical(v: unknown): string {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
    if (v && typeof v === 'object') {
        return (
            '{' +
            Object.keys(v as Record<string, unknown>)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k]))
                .join(',') +
            '}'
        )
    }
    return JSON.stringify(v)
}

export interface AgentSnapshot {
    env: Record<string, string>
    flags: Record<string, { enabled: boolean }>
    version: string
}

function buildSnapshot(instanceId: string): AgentSnapshot {
    // canReadSecrets=true — this endpoint IS the reveal path for a machine holding
    // a valid instance key (move_wharf_to_perch.md §9).
    const resolved = configVars.resolveInstance(instanceId, true)
    const env: Record<string, string> = {}
    for (const e of resolved.env) env[e.key] = e.value

    const flags: Record<string, { enabled: boolean }> = {}
    for (const f of flagRepo.listByInstance(instanceId)) flags[f.key] = { enabled: f.enabled }

    const version = crypto.createHash('sha256').update(canonical({ env, flags })).digest('hex').slice(0, 16)
    return { env, flags, version }
}

export type AgentRequestResult =
    | { ok: true; instanceId: string; snapshot: AgentSnapshot }
    | { ok: false; response: NextResponse }

/**
 * Authenticate + resolve one machine fetch (move_wharf_to_perch.md §9):
 * `X-Perch-Instance` + bearer secret, timing-safe compared against the
 * instance's key hash. A matching `If-None-Match` short-circuits to 304 (still
 * stamps `last_fetch_at`, but is NOT audited, bounding audit growth); a 200
 * stamps the watermark and audits `runtime.fetch` (system-attributed,
 * `github_id = NULL`).
 */
export function beginAgentFetch(req: Request, pathname: string): AgentRequestResult {
    const name = req.headers.get('x-perch-instance') ?? undefined
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || undefined
    const auth = instances.authenticateInstance(name, bearer)
    if (!auth.ok) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: auth.status === 404 ? 'unknown_instance' : 'unauthorized' },
                { status: auth.status },
            ),
        }
    }

    const snapshot = buildSnapshot(auth.instanceId)
    const now = new Date().toISOString()

    if (req.headers.get('if-none-match') === snapshot.version) {
        instanceRepo.touchFetch(auth.instanceId, now)
        return { ok: false, response: new NextResponse(null, { status: 304, headers: { ETag: snapshot.version } }) }
    }

    instanceRepo.touchFetch(auth.instanceId, now)
    auditRepo.append({
        githubId: null,
        login: 'agent',
        action: 'runtime.fetch',
        detail: `${pathname} instance:${auth.instanceId}`,
    })
    return { ok: true, instanceId: auth.instanceId, snapshot }
}
