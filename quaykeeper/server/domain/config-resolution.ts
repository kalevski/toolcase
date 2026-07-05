// Pure per-row config resolution (move_wharf_to_perch.md §4). No merge order,
// no interpolation, no cycles — each env_var row resolves independently by its
// `source`: a literal value, or a single reference to a global variable or
// secret. This replaces wharf's env-resolution.ts + interpolate.ts wholesale.

import type { EnvVarSource, ResolvedConfig, ResolvedEnvEntry } from '@/server/domain/types'

/** The minimal env-var shape resolution needs (decoupled from the repo row). */
export interface ResolvableEnvVar {
    key: string
    source: EnvVarSource
    /** literal text (source='literal'). */
    value?: string
    globalVarId?: string
    secretId?: string
    updatedAt: string
}

/** The minimal global-variable shape resolution needs. */
export interface ResolvableGlobalVar {
    value: string
    updatedAt: string
}

/** The minimal secret shape resolution needs (metadata only — the decrypted
 *  value is supplied separately via `secretValuesById`, only when authorized). */
export interface ResolvableSecret {
    key: string
    updatedAt: string
}

/**
 * Resolve one instance's env vars to their final values (move_wharf_to_perch.md
 * §4). Per row, by `source`:
 *
 *   - `literal` → `value` as-is.
 *   - `global`  → the referenced global variable's current value (empty string
 *                 if the reference is dangling).
 *   - `secret`  → the decrypted secret value if `canReadSecrets` (via
 *                 `secretValuesById`), else the masked placeholder
 *                 `<hidden:KEY>` (wharf's masking convention carried over).
 *
 * Plus, per row, a `pending` marker: true if the row's `updatedAt` — or, for a
 * reference, the referenced global/secret's `updatedAt` (whichever is later) —
 * is later than `lastFetchAt` (lexical ISO comparison; an undefined watermark
 * means nothing is pending).
 */
export function resolveConfig(
    vars: ResolvableEnvVar[],
    globalsById: ReadonlyMap<string, ResolvableGlobalVar>,
    secretsById: ReadonlyMap<string, ResolvableSecret>,
    secretValuesById: ReadonlyMap<string, string>,
    canReadSecrets: boolean,
    lastFetchAt?: string,
): ResolvedConfig {
    const env: ResolvedEnvEntry[] = []
    const pending: string[] = []

    for (const v of vars) {
        let value: string
        let masked = false
        let effectiveUpdatedAt = v.updatedAt

        if (v.source === 'literal') {
            value = v.value ?? ''
        } else if (v.source === 'global') {
            const g = v.globalVarId ? globalsById.get(v.globalVarId) : undefined
            value = g?.value ?? ''
            if (g && g.updatedAt > effectiveUpdatedAt) effectiveUpdatedAt = g.updatedAt
        } else {
            const secret = v.secretId ? secretsById.get(v.secretId) : undefined
            if (canReadSecrets) {
                value = (v.secretId && secretValuesById.get(v.secretId)) ?? ''
            } else {
                value = `<hidden:${secret?.key ?? v.key}>`
                masked = true
            }
            if (secret && secret.updatedAt > effectiveUpdatedAt) effectiveUpdatedAt = secret.updatedAt
        }

        const isPending = !!lastFetchAt && effectiveUpdatedAt > lastFetchAt
        if (isPending) pending.push(v.key)
        env.push({ key: v.key, value, source: v.source, masked, pending: isPending })
    }

    return { env, pending }
}
