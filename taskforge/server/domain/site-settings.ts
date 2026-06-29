// Pure instance-branding decisions — no `server-only`, no I/O, so the rules behind
// `services/site-settings.ts` are unit-testable in isolation AND the type + defaults
// are safe to import from the client branding context.
//
// TaskForge's brand wordmark ("Task Forge") and accent (#6c5ce7) stay fixed; the one
// configurable piece is `secondaryText` — an optional second word shown inline after
// the wordmark in `tc-brand` (sidebar brand + login logo). Stored in the `meta` KV
// table by `services/site-settings.ts` (the only `server-only` wiring).

/**
 * The full, effective instance settings. Every field has a default, so a fresh
 * instance (no stored `meta` rows) still resolves to a complete record.
 */
export interface SiteSettings {
    /** Optional second brand word shown inline after "Task Forge" in `tc-brand`. */
    secondaryText: string
}

/** Built-in defaults for a fresh instance (no stored override yet). */
export const DEFAULT_SETTINGS: SiteSettings = {
    secondaryText: '',
}

/** Map each settings field to its `meta.key`. The DB stores raw strings. */
export const SETTING_KEYS: Record<keyof SiteSettings, string> = {
    secondaryText: 'brand_secondary_text',
}

/** Max length for the free-text fields (defensive — keeps the brand sane). */
export const SECONDARY_TEXT_MAX = 40

/** Why a settings patch was rejected (the service maps it to a 400). */
export type SettingsRejection = 'not_object' | 'secondary_text'

/** Result of {@link parseSettingsUpdate}: the normalized patch, or a typed rejection. */
export type SettingsCheck =
    | { ok: true; patch: Partial<SiteSettings> }
    | { ok: false; reason: SettingsRejection; message: string }

/**
 * Validate + normalize an admin-supplied settings patch (the `PUT /api/admin/settings`
 * body). Every field is OPTIONAL — only present, non-undefined fields are validated
 * and returned. `secondaryText` is a string ≤ {@link SECONDARY_TEXT_MAX} chars
 * (trimmed; may be empty to clear it). Pure (no I/O), so the rules are unit-testable.
 */
export function parseSettingsUpdate(input: unknown): SettingsCheck {
    if (!input || typeof input !== 'object') {
        return { ok: false, reason: 'not_object', message: 'settings must be an object' }
    }
    const src = input as Record<string, unknown>
    const patch: Partial<SiteSettings> = {}

    if (src.secondaryText !== undefined) {
        if (typeof src.secondaryText !== 'string' || src.secondaryText.trim().length > SECONDARY_TEXT_MAX) {
            return {
                ok: false,
                reason: 'secondary_text',
                message: `secondaryText must be ≤ ${SECONDARY_TEXT_MAX} characters`,
            }
        }
        patch.secondaryText = src.secondaryText.trim()
    }

    return { ok: true, patch }
}

/**
 * Decode a raw `meta` key→value map into a typed partial settings record. The service
 * merges this over {@link DEFAULT_SETTINGS} to get the effective record. Unrelated
 * `meta` rows (migration flags etc.) are ignored — only known keys are read.
 */
export function decodeStored(map: Record<string, string>): Partial<SiteSettings> {
    const out: Partial<SiteSettings> = {}
    const secondaryText = map[SETTING_KEYS.secondaryText]
    if (typeof secondaryText === 'string') out.secondaryText = secondaryText
    return out
}
