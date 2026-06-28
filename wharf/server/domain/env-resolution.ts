// Pure resolver for an instance's final environment (planning §3.1 cascade,
// §3.2 pending, decisions #1/#11/#12). No I/O — the caller fetches rows + secret
// values + watermark and hands them in; this module only computes the result.

import type { EnvVarSource, ResolvedConfig, ResolvedEntry } from '@/server/domain/types'
import { interpolateAll } from '@/server/domain/interpolate'

/** One authoring row at one scope. Mirrors the env_var table (planning §4 v5). */
export interface EnvRow {
    key: string
    source: EnvVarSource
    /** Literal value (literals only); ignored for secret_ref. */
    value?: string
    /** Set iff source === 'secret_ref'. */
    secretId?: string
    /** Meaningful on baseline rows: declares the key required (planning §3.1). */
    required: boolean
    /** ISO timestamp of last edit (drives §3.2 pending). */
    updatedAt: string
}

/** Inputs the resolver needs — gathered by the caller, then resolved purely. */
export interface ResolveInput {
    /** Environment-scope rows (instance_id null) — the baseline. */
    baseline: EnvRow[]
    /** Instance-scope rows — override the baseline on key collision (decision #1). */
    overrides: EnvRow[]
    /** True for devops/owner, or an Agent API call w/ a valid instance key. */
    canReadSecrets: boolean
    /** secretId -> REAL plaintext value; present ONLY when canReadSecrets. */
    secretValues?: Record<string, string>
    /** secretId -> { secret name (key), updatedAt } — always available (keys-only). */
    secretMeta: Record<string, { key: string; updatedAt: string }>
    /** Instance applied-as-of watermark (ISO); undefined = never fetched (§3.2). */
    lastFetchAt?: string
}

interface WinningRow {
    key: string
    row: EnvRow
    /** True if the winning row came from the instance-scope overrides. */
    isOverride: boolean
}

/** Masked placeholder shown to an unauthorized caller (decision #12). */
function maskedPlaceholder(
    secretId: string | undefined,
    secretMeta: ResolveInput['secretMeta'],
): string {
    const name = (secretId !== undefined ? secretMeta[secretId]?.key : undefined) ?? 'secret'
    return `<hidden:${name}>`
}

/**
 * Resolve an instance's final environment: merge baseline+overrides (§3.1),
 * mask secrets for unauthorized callers (decision #12), interpolate literals
 * (§8.5), then flag missing-required (§3.1) and pending edits (§3.2).
 */
export function resolveConfig(input: ResolveInput): ResolvedConfig {
    const { baseline, overrides, canReadSecrets, secretValues, secretMeta, lastFetchAt } = input

    // 1. Merge — baseline order is the stable declaration order; instance rows win
    //    on collision (decision #1). Track override-only keys to append after.
    const winning = new Map<string, WinningRow>()
    const order: string[] = []
    for (const row of baseline) {
        if (!winning.has(row.key)) {
            order.push(row.key)
        }
        winning.set(row.key, { key: row.key, row, isOverride: false })
    }
    for (const row of overrides) {
        if (!winning.has(row.key)) {
            order.push(row.key)
        }
        winning.set(row.key, { key: row.key, row, isOverride: true })
    }

    // 2. Pre-interpolation map: literals -> their raw value; secret_ref -> real
    //    value (authorized) or masked placeholder (decision #12). Placeholder &
    //    secret strings contain no ${} so they survive interpolation untouched.
    const raw: Record<string, string> = {}
    for (const key of order) {
        const { row } = winning.get(key)!
        if (row.source === 'secret_ref') {
            const real =
                canReadSecrets && row.secretId !== undefined
                    ? secretValues?.[row.secretId]
                    : undefined
            raw[key] = real !== undefined ? real : maskedPlaceholder(row.secretId, secretMeta)
        } else {
            raw[key] = row.value ?? ''
        }
    }

    // 3. Interpolate. A literal `${DBPASS}` referencing a masked secret resolves to
    //    that masked placeholder (decision #12). Cycle errors propagate.
    const resolvedValues = interpolateAll(raw)

    // Determine pending flags (§3.2): undefined watermark => nothing is pending.
    const isPending = (w: WinningRow): boolean => {
        if (lastFetchAt === undefined) {
            return false
        }
        // ISO timestamps compare lexically.
        if (w.row.updatedAt > lastFetchAt) {
            return true
        }
        // A secret_ref is also pending if its referenced secret changed after fetch.
        if (w.row.source === 'secret_ref' && w.row.secretId !== undefined) {
            const meta = secretMeta[w.row.secretId]
            if (meta !== undefined && meta.updatedAt > lastFetchAt) {
                return true
            }
        }
        return false
    }

    // 4-6. Build entries (stable order) + missingRequired + pending.
    const env: ResolvedEntry[] = []
    const missingRequired: string[] = []
    const pending: string[] = []

    for (const key of order) {
        const w = winning.get(key)!
        const source = w.row.source
        const value = resolvedValues[key]
        // masked: winning source is a secret the caller may not read (§3.1).
        const masked = source === 'secret_ref' && !canReadSecrets
        const pendingFlag = isPending(w)

        const entry: ResolvedEntry = {
            key,
            value,
            source,
            masked,
        }
        if (pendingFlag) {
            entry.pending = true
            pending.push(key)
        }
        env.push(entry)

        // 5. missingRequired: required baseline key that resolves empty. A
        //    secret_ref always counts as non-empty (it has a value or a placeholder).
        if (w.row.required && source !== 'secret_ref' && value === '') {
            missingRequired.push(key)
        }
    }

    return { env, missingRequired, pending }
}
