// Global instance-settings service — the policy layer behind the settings routes.
// Two surfaces:
//
//   • PUBLIC read  (`GET /api/settings`)            — the effective branding, readable
//     by anyone (the login screen needs the secondary brand text before auth).
//   • ADMIN write  (`GET`/`PUT /api/admin/settings`) — read + replace, admin-gated;
//     the route attributes the change to the acting admin in the audit log.
//
// The effective record is `DEFAULT_SETTINGS` ← the stored `meta` overrides, so a fresh
// instance resolves to a complete record. Pure validation + (de)coding live in
// `domain/site-settings.ts`; this is the `server-only` wiring (repo).

import 'server-only'
import * as repo from '@/server/data/repositories/site-settings-repo'
import {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    decodeStored,
    parseSettingsUpdate,
    type SiteSettings,
} from '@/server/domain/site-settings'

/**
 * A settings refusal: a malformed body (`400`). Carries the machine-readable `code`
 * and HTTP `status` a route returns. Settings only ever reject with 400.
 */
export class SettingsError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 = 400,
    ) {
        super(message)
        this.name = 'SettingsError'
    }
}

/** Built-in defaults, then any stored override on top. Always a complete record. */
export function getSettings(): SiteSettings {
    return { ...DEFAULT_SETTINGS, ...decodeStored(repo.getAll()) }
}

/**
 * The public projection (`GET /api/settings`). Currently identical to the full record
 * — the secondary brand text is non-sensitive — but kept as its own function so a
 * future secret setting isn't leaked by default.
 */
export function getPublicSettings(): SiteSettings {
    return getSettings()
}

/**
 * Validate + persist an admin-supplied settings patch (`PUT /api/admin/settings`):
 * only the present fields are written. Returns the new effective record. Throws
 * {@link SettingsError} (400) on a malformed body.
 */
export function updateSettings(input: unknown): SiteSettings {
    const checked = parseSettingsUpdate(input)
    if (!checked.ok) throw new SettingsError(checked.message, `settings_${checked.reason}`)

    const entries: Record<string, string> = {}
    for (const [field, value] of Object.entries(checked.patch)) {
        entries[SETTING_KEYS[field as keyof SiteSettings]] = value as string
    }
    if (Object.keys(entries).length > 0) repo.setMany(entries)

    return getSettings()
}

/** Map any error a settings operation can throw to its HTTP status + code. */
export function httpErrorFor(err: unknown): { status: number; code: string } {
    if (err instanceof SettingsError) return { status: err.status, code: err.code }
    return { status: 500, code: 'internal_error' }
}
