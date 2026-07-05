// Machine-facing instance fetch service (move_wharf_to_perch.md §9). Serves the
// companion agent listener (`server/agent-server.ts`) — a cookieless `node:http`
// server on `QUAYKEEPER_AGENT_PORT`, separate from the Next.js UI/API port.
// Transport-neutral: the listener parses headers and maps the typed result to a
// response. Read-only, instance-key authenticated.

import 'server-only'
import crypto from 'node:crypto'
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

/** The auth material one fetch carries, parsed from headers by the listener. */
export interface AgentFetchInput {
    /** `X-Quaykeeper-Instance` — the instance name. */
    instanceName?: string
    /** `Authorization: Bearer <secret>` — the raw fetch key. */
    bearer?: string
    /** `If-None-Match` — the client's last-seen snapshot version. */
    ifNoneMatch?: string
}

export type AgentFetchResult =
    | { kind: 'ok'; instanceId: string; snapshot: AgentSnapshot }
    | { kind: 'not_modified'; version: string }
    | { kind: 'unauthorized' }

/**
 * Authenticate + resolve one machine fetch (move_wharf_to_perch.md §9):
 * `X-Quaykeeper-Instance` + bearer secret, timing-safe compared against the
 * instance's key hash. Unknown instance and bad key both come back as a uniform
 * `unauthorized` so the endpoint is not an instance-name enumeration oracle.
 * A matching `If-None-Match` short-circuits to `not_modified` (still stamps
 * `last_fetch_at`, but is NOT audited, bounding audit growth); an `ok` stamps
 * the watermark and audits `runtime.fetch` (system-attributed, `github_id = NULL`).
 */
export function beginAgentFetch(input: AgentFetchInput, pathname: string): AgentFetchResult {
    const auth = instances.authenticateInstance(input.instanceName, input.bearer)
    if (!auth.ok) return { kind: 'unauthorized' }

    const snapshot = buildSnapshot(auth.instanceId)
    const now = new Date().toISOString()

    if (input.ifNoneMatch === snapshot.version) {
        instanceRepo.touchFetch(auth.instanceId, now)
        return { kind: 'not_modified', version: snapshot.version }
    }

    instanceRepo.touchFetch(auth.instanceId, now)
    auditRepo.append({
        githubId: null,
        login: 'agent',
        action: 'runtime.fetch',
        detail: `${pathname} instance:${auth.instanceId}`,
    })
    return { kind: 'ok', instanceId: auth.instanceId, snapshot }
}
