// Pure feature-flag registry + resolution — safe to import from client AND
// server (no `import 'server-only'`, no I/O). One canonical list of gateable
// features so the global settings, the per-user overrides, the sidebar nav, and
// the command palette all read from a single source and never drift.
//
// Two layers gate a feature for a user:
//   • global flags  — owner-set, app-wide master switch per feature (Settings).
//   • per-user flags — owner override of a single user's access (Users admin).
//
// Effective visibility (see {@link resolveFeatureVisibility}):
//   owner                       → always true (owners manage every feature)
//   otherwise                   → globalEnabled(feature) && (override ?? true)
//
// Admin pages are NOT feature-gated — they stay owner-only regardless of flags.

import type { Role } from './types'

/** A gateable top-level feature. Each maps to one or more routes under `app/`. */
export type FeatureKey =
    | 'static_sites' // '/' — the static-sites dashboard
    | 'instances' // '/instances' — the Config subsystem
    | 'databases' // '/databases' — database-server management
    | 'snippets' // '/snippets' — saved docker-run snippets
    | 'jobs' // '/jobs' — scheduled tasks
    | 'routing' // proxies / redirects / dead-hosts / access-lists / streams

/** Registry metadata for one feature (label + one-line help for the Settings UI). */
export interface FeatureDef {
    key: FeatureKey
    label: string
    description: string
}

/** The canonical feature list, in display order. */
export const FEATURES: readonly FeatureDef[] = [
    {
        key: 'static_sites',
        label: 'Static sites',
        description: 'Deploy and manage static sites from GitHub repos.',
    },
    {
        key: 'instances',
        label: 'Config instances',
        description: 'The Config subsystem — variables, secrets, and instances.',
    },
    {
        key: 'databases',
        label: 'Databases',
        description: 'Register database servers and manage databases, users, and access.',
    },
    {
        key: 'snippets',
        label: 'Docker snippets',
        description: 'Save and render reusable docker-run recipes.',
    },
    { key: 'jobs', label: 'Scheduled jobs', description: 'Cron and on-demand shell/Node jobs.' },
    {
        key: 'routing',
        label: 'Routing',
        description: 'Proxies, redirects, dead hosts, access lists, and streams.',
    },
]

/** Every feature key, in registry order. */
export const FEATURE_KEYS: readonly FeatureKey[] = FEATURES.map((f) => f.key)

/** Default global enablement — every feature ships enabled; the owner disables. */
export const DEFAULT_FEATURE_ENABLED: Record<FeatureKey, boolean> = {
    static_sites: true,
    instances: true,
    databases: true,
    snippets: true,
    jobs: true,
    routing: true,
}

/** Type guard: a request-supplied value is a known feature key. */
export function isFeatureKey(value: unknown): value is FeatureKey {
    return typeof value === 'string' && (FEATURE_KEYS as readonly string[]).includes(value)
}

/**
 * Resolve effective feature visibility for one user. Pure (no I/O), so it's
 * unit-testable and shared by `/api/me` and the per-user admin editor.
 *
 * @param role       the caller's live role — owners see everything.
 * @param global     the app-wide flags (absent key ⇒ {@link DEFAULT_FEATURE_ENABLED}).
 * @param overrides  the caller's explicit per-user toggles (absent key ⇒ follow global).
 */
export function resolveFeatureVisibility(
    role: Role,
    global?: Partial<Record<FeatureKey, boolean>> | null,
    overrides?: Partial<Record<FeatureKey, boolean>> | null,
): Record<FeatureKey, boolean> {
    const out = {} as Record<FeatureKey, boolean>
    for (const key of FEATURE_KEYS) {
        if (role === 'owner') {
            out[key] = true
            continue
        }
        const globalOn = global?.[key] ?? DEFAULT_FEATURE_ENABLED[key]
        if (!globalOn) {
            out[key] = false
            continue
        }
        out[key] = overrides?.[key] ?? true
    }
    return out
}
