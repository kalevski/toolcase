// Per-user feature-override repository — all SQL for the `user_feature` table.
// A row exists only when the owner has explicitly toggled a feature for a user;
// absence of a row means "follow the global default". The merge of
// override-over-global-over-default lives in `services/features.ts` via the pure
// `resolveFeatureVisibility`; this layer is only the raw CRUD.

import 'server-only'
import { prep, allRows, tx } from '@/server/data/db'
import { isFeatureKey, type FeatureKey } from '@/server/domain/features'

interface Raw {
    github_id: number
    feature_key: string
    enabled: number
}

/** The explicit per-user overrides for one user (absent features follow global). */
export function get(githubId: number): Partial<Record<FeatureKey, boolean>> {
    const out: Partial<Record<FeatureKey, boolean>> = {}
    for (const r of allRows<Raw>('SELECT feature_key, enabled FROM user_feature WHERE github_id = ?', githubId)) {
        if (isFeatureKey(r.feature_key)) out[r.feature_key] = r.enabled === 1
    }
    return out
}

/**
 * Replace a user's overrides with `overrides`. An entry present sets an explicit
 * toggle; a key mapped to `undefined` (or simply omitted) clears that override so
 * the feature falls back to the global default. Runs in one transaction.
 */
export function setMany(
    githubId: number,
    overrides: Partial<Record<FeatureKey, boolean>>,
    updatedAt: string = new Date().toISOString(),
): void {
    tx(() => {
        for (const [key, value] of Object.entries(overrides)) {
            if (!isFeatureKey(key)) continue
            if (value === undefined) {
                remove(githubId, key)
                continue
            }
            prep(
                `INSERT INTO user_feature (github_id, feature_key, enabled, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(github_id, feature_key) DO UPDATE SET
                    enabled = excluded.enabled, updated_at = excluded.updated_at`,
            ).run(githubId, key, value ? 1 : 0, updatedAt)
        }
    })
}

/** Clear one feature override for a user (idempotent). */
export function remove(githubId: number, key: FeatureKey): void {
    prep('DELETE FROM user_feature WHERE github_id = ? AND feature_key = ?').run(githubId, key)
}
