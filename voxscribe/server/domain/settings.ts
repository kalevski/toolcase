// Instance settings domain (branding + theme), mirroring quaykeeper's §13
// surface. Pure and client-shared (no 'server-only'): the Settings form and
// the BrandingProvider import the types, defaults and guards directly.

// ── themes (must track the @toolcase/web-components bundled skins) ──────────

/**
 * Every selectable theme. These are exactly the skins the web-components
 * library ships (`default` is the global `:root` voice; the rest are scoped
 * under `[data-tc-theme="…"]`). The admin picker offers all of them and the
 * client applies the chosen one as `data-tc-theme` on the document root, so
 * every `tc-*` element re-skins at once.
 */
export const THEME_NAMES = ['default', 'dungeon', 'aurora', 'sunshine', 'neon', 'blueprint'] as const

export type ThemeName = (typeof THEME_NAMES)[number]

/** Human labels for the theme picker (the stored value is the lowercase key). */
export const THEME_LABEL: Record<ThemeName, string> = {
    default: 'Default (slate)',
    dungeon: 'Dungeon (gilded fantasy)',
    aurora: 'Aurora (dark)',
    sunshine: 'Sunshine (warm citrus)',
    neon: 'Neon (synthwave)',
    blueprint: 'Blueprint (light vector)',
}

/** Type guard: a request-supplied value is one of the bundled theme names. */
export function isThemeName(value: unknown): value is ThemeName {
    return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value)
}

/**
 * Accent variants — every bundled theme ships all eleven (see the library's
 * `style/themes/VARIANTS.md`). A variant swaps only the primary/secondary
 * accents; `''` means "the theme's base accents". `sunset` and `twilight` are
 * gradient variants (two-stop primary). Applied as `data-tc-variant` next to
 * `data-tc-theme` on the document root.
 */
export const THEME_VARIANTS = [
    'ocean',
    'forest',
    'ember',
    'royal',
    'mint',
    'rose',
    'crimson',
    'indigo',
    'slate',
    'sunset',
    'twilight',
] as const

export type ThemeVariant = (typeof THEME_VARIANTS)[number]

/** Human labels for the variant half of the theme picker. */
export const THEME_VARIANT_LABEL: Record<ThemeVariant, string> = {
    ocean: 'Ocean (blue/cyan)',
    forest: 'Forest (green/lime)',
    ember: 'Ember (orange/gold)',
    royal: 'Royal (violet/magenta)',
    mint: 'Mint (teal/mint)',
    rose: 'Rose (rose/pink)',
    crimson: 'Crimson (red/coral)',
    indigo: 'Indigo (indigo/periwinkle)',
    slate: 'Slate (steel/silver)',
    sunset: 'Sunset (coral → orange)',
    twilight: 'Twilight (violet → blue)',
}

/** Type guard: a request-supplied value is a bundled accent variant. */
export function isThemeVariant(value: unknown): value is ThemeVariant {
    return typeof value === 'string' && (THEME_VARIANTS as readonly string[]).includes(value)
}

// ── settings record ──────────────────────────────────────────────────────────

export interface SiteSettings {
    /** Brand primary text — sidebar brand, login screen, browser tab. */
    appName: string
    /** One line under the brand on the login screen + the meta description. */
    tagline: string
    /** Optional second word shown inline after the app name in the brand. */
    secondaryText: string
    theme: ThemeName
    /** '' = the theme's base accents. */
    themeVariant: ThemeVariant | ''
    /** Brand underline / login logo colour; '' = the theme's accent. */
    brandColor: string
}

export const DEFAULT_SETTINGS: SiteSettings = {
    appName: 'voxscribe',
    tagline: 'Self-hosted audio transcription studio with tagged markdown notes.',
    secondaryText: 'transcription studio',
    theme: 'default',
    themeVariant: '',
    brandColor: '',
}

/** `app_setting.key` per settings field. */
export const SETTING_KEYS: Record<keyof SiteSettings, string> = {
    appName: 'app_name',
    tagline: 'tagline',
    secondaryText: 'secondary_text',
    theme: 'theme',
    themeVariant: 'theme_variant',
    brandColor: 'brand_color',
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const APP_NAME_MAX = 60
const TAGLINE_MAX = 200
const SECONDARY_MAX = 60

export interface SettingsValidationError {
    field: keyof SiteSettings
    message: string
}

export type SettingsPatch = Partial<SiteSettings>

/**
 * Validate a PUT body into a patch of known fields. Unknown fields are
 * ignored; every supplied field must be a string that passes its guard.
 */
export function parseSettingsUpdate(
    input: unknown,
): { ok: true; patch: SettingsPatch } | { ok: false; error: SettingsValidationError } {
    if (typeof input !== 'object' || input === null) {
        return { ok: false, error: { field: 'appName', message: 'body must be a JSON object' } }
    }
    const body = input as Record<string, unknown>
    const patch: SettingsPatch = {}

    const text = (
        field: 'appName' | 'tagline' | 'secondaryText',
        max: number,
        required: boolean,
    ): SettingsValidationError | null => {
        const raw = body[field]
        if (raw === undefined) return null
        if (typeof raw !== 'string') return { field, message: `${field} must be a string` }
        const value = raw.trim()
        if (required && value === '') return { field, message: `${field} is required` }
        if (value.length > max) return { field, message: `${field} must be at most ${max} characters` }
        patch[field] = value
        return null
    }

    const err = text('appName', APP_NAME_MAX, true) ?? text('tagline', TAGLINE_MAX, false) ?? text('secondaryText', SECONDARY_MAX, false)
    if (err) return { ok: false, error: err }

    if (body.theme !== undefined) {
        if (!isThemeName(body.theme)) return { ok: false, error: { field: 'theme', message: 'unknown theme' } }
        patch.theme = body.theme
    }
    if (body.themeVariant !== undefined) {
        if (body.themeVariant !== '' && !isThemeVariant(body.themeVariant)) {
            return { ok: false, error: { field: 'themeVariant', message: 'unknown theme variant' } }
        }
        patch.themeVariant = body.themeVariant as ThemeVariant | ''
    }
    if (body.brandColor !== undefined) {
        if (typeof body.brandColor !== 'string' || (body.brandColor !== '' && !HEX_COLOR_RE.test(body.brandColor))) {
            return { ok: false, error: { field: 'brandColor', message: 'brand colour must be a #rgb or #rrggbb hex (or empty for the theme accent)' } }
        }
        patch.brandColor = body.brandColor
    }

    return { ok: true, patch }
}

/**
 * Decode raw `app_setting` rows into a partial settings record, dropping any
 * stored value that no longer passes its guard (e.g. a theme that was removed
 * from the library) so a bad row can never break rendering.
 */
export function decodeStored(rows: Record<string, string>): SettingsPatch {
    const out: SettingsPatch = {}
    const byKey = new Map(Object.entries(SETTING_KEYS).map(([field, key]) => [key, field as keyof SiteSettings]))
    for (const [key, value] of Object.entries(rows)) {
        const field = byKey.get(key)
        if (!field) continue
        if (field === 'theme') {
            if (isThemeName(value)) out.theme = value
        } else if (field === 'themeVariant') {
            if (value === '' || isThemeVariant(value)) out.themeVariant = value as ThemeVariant | ''
        } else if (field === 'brandColor') {
            if (value === '' || HEX_COLOR_RE.test(value)) out.brandColor = value
        } else {
            out[field] = value
        }
    }
    return out
}
