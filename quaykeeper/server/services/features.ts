// Feature-flag service — the `server-only` wiring behind the two-layer feature
// gate (global app-wide flags + per-user overrides). Global flags are stored as
// `feature.<key>` rows in the generic `app_setting` KV (no dedicated table);
// per-user overrides live in `user_feature`. Effective visibility is computed by
// the pure `resolveFeatureVisibility` (domain/features.ts) and consumed by both
// `/api/me` (client gating) and `authorize(minRole, feature)` (server enforcement).

import 'server-only'
import * as settingRepo from '@/server/data/repositories/setting-repo'
import * as userFeatureRepo from '@/server/data/repositories/user-feature-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { slog } from '@/server/infrastructure/server-log'
import {
    DEFAULT_FEATURE_ENABLED,
    FEATURE_KEYS,
    isFeatureKey,
    resolveFeatureVisibility,
    type FeatureKey,
} from '@/server/domain/features'
import type { Role } from '@/server/domain/types'

const PREFIX = 'feature.'

/** The app-wide global flags, parsed from the `feature.<key>` settings rows. */
export function globalFlags(): Partial<Record<FeatureKey, boolean>> {
    const all = settingRepo.getAll()
    const out: Partial<Record<FeatureKey, boolean>> = {}
    for (const key of FEATURE_KEYS) {
        const stored = all[`${PREFIX}${key}`]
        if (stored !== undefined) out[key] = stored === 'true'
    }
    return out
}

/** The full global flag set with defaults applied — the owner Settings view. */
export function globalFlagsWithDefaults(): Record<FeatureKey, boolean> {
    const stored = globalFlags()
    const out = {} as Record<FeatureKey, boolean>
    for (const key of FEATURE_KEYS) out[key] = stored[key] ?? DEFAULT_FEATURE_ENABLED[key]
    return out
}

/** Persist owner-set global flags (only known keys), audited. */
export function setGlobalFlags(
    actor: { githubId: number; login: string },
    flags: Partial<Record<FeatureKey, boolean>>,
): Record<FeatureKey, boolean> {
    const entries: Record<string, string> = {}
    const changed: string[] = []
    for (const [key, value] of Object.entries(flags)) {
        if (!isFeatureKey(key) || typeof value !== 'boolean') continue
        entries[`${PREFIX}${key}`] = value ? 'true' : 'false'
        changed.push(`${key}=${value}`)
    }
    if (changed.length > 0) {
        settingRepo.setMany(entries)
        auditRepo.append({
            githubId: actor.githubId,
            login: actor.login,
            action: 'admin.features.global',
            site: null,
            detail: changed.join(','),
        })
        slog('info', 'features', 'global feature flags updated', { by: actor.login, changed })
    }
    return globalFlagsWithDefaults()
}

/** The explicit per-user overrides for a user (absent features follow global). */
export function userOverrides(githubId: number): Partial<Record<FeatureKey, boolean>> {
    return userFeatureRepo.get(githubId)
}

/** Persist owner-set per-user overrides, audited. */
export function setUserOverrides(
    actor: { githubId: number; login: string },
    targetGithubId: number,
    targetLogin: string,
    overrides: Partial<Record<FeatureKey, boolean>>,
): Partial<Record<FeatureKey, boolean>> {
    const clean: Partial<Record<FeatureKey, boolean>> = {}
    for (const [key, value] of Object.entries(overrides)) {
        if (!isFeatureKey(key)) continue
        // null/undefined ⇒ clear the override (fall back to global default).
        clean[key] = value === null || value === undefined ? undefined : Boolean(value)
    }
    userFeatureRepo.setMany(targetGithubId, clean)
    auditRepo.append({
        githubId: actor.githubId,
        login: actor.login,
        action: 'admin.features.user',
        site: null,
        detail: `${targetLogin}: ${Object.entries(clean)
            .map(([k, v]) => `${k}=${v ?? 'inherit'}`)
            .join(',')}`,
    })
    slog('info', 'features', 'user feature overrides updated', { by: actor.login, target: targetLogin })
    return userFeatureRepo.get(targetGithubId)
}

/**
 * Effective feature visibility for one user — the app-wide flags merged with the
 * user's per-user overrides. Owners always get every feature (they manage them).
 */
export function resolveFeatures(githubId: number, role: Role): Record<FeatureKey, boolean> {
    if (role === 'owner') return resolveFeatureVisibility('owner')
    return resolveFeatureVisibility(role, globalFlags(), userFeatureRepo.get(githubId))
}

/** Whether a single feature is visible to a user (the `authorize` fast path). */
export function featureEnabledFor(githubId: number, role: Role, feature: FeatureKey): boolean {
    return resolveFeatures(githubId, role)[feature]
}

/** Resolve visibility from an already-loaded login (admin roster batch use). */
export function resolveFeaturesByLogin(login: string): Record<FeatureKey, boolean> {
    const user = userRepo.getByLogin(login)
    if (!user) return resolveFeatureVisibility('guest', globalFlags(), null)
    return resolveFeatures(user.githubId, user.role)
}
