// Instance settings service (branding + theme — quaykeeper §13 mirror).
// The effective record is DEFAULT_SETTINGS ← stored overrides; updates
// validate through the shared domain parser and upsert only supplied fields.

import 'server-only'
import * as settingRepo from '@/server/data/repositories/setting-repo'
import {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    decodeStored,
    parseSettingsUpdate,
    type SiteSettings,
} from '@/server/domain/settings'

export class SettingsError extends Error {
    constructor(
        message: string,
        public field: string,
        public status: number = 400,
    ) {
        super(message)
        this.name = 'SettingsError'
    }
}

export function httpErrorFor(err: SettingsError): { status: number; body: Record<string, unknown> } {
    return { status: err.status, body: { error: err.message, field: err.field } }
}

/** The effective settings record (defaults overlaid with stored overrides). */
export function getSettings(): SiteSettings {
    const stored = decodeStored(settingRepo.getAll())
    return { ...DEFAULT_SETTINGS, ...stored }
}

/**
 * The PUBLIC projection — read unauthenticated by the login screen and the
 * BrandingProvider before any session exists. Every field is non-sensitive
 * branding, so it equals the full record.
 */
export function getPublicSettings(): SiteSettings {
    return getSettings()
}

/**
 * Validate + persist a partial update; returns the new effective record and a
 * human `detail` line for the caller's audit entry ('' when nothing changed).
 */
export function updateSettings(input: unknown): { settings: SiteSettings; detail: string } {
    const checked = parseSettingsUpdate(input)
    if (!checked.ok) throw new SettingsError(checked.error.message, checked.error.field)

    const entries: Record<string, string> = {}
    for (const [field, value] of Object.entries(checked.patch)) {
        entries[SETTING_KEYS[field as keyof SiteSettings]] = value as string
    }

    let detail = ''
    if (Object.keys(entries).length > 0) {
        settingRepo.setMany(entries)
        detail = Object.entries(checked.patch)
            .map(([k, v]) => `${k}=${v === '' ? '(cleared)' : v}`)
            .join(',')
    }

    return { settings: getSettings(), detail }
}
