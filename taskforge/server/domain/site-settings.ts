// Pure instance-branding decisions — no `server-only`, no I/O, so the rules behind
// `services/site-settings.ts` are unit-testable in isolation AND the type + defaults
// are safe to import from the client branding context.
//
// Everything the branding surface supports is configurable here: the brand wordmark
// (`primaryText`, default "Task Forge"), the optional second word (`secondaryText`),
// the small brand label + accent color `tc-brand` renders, and the tc-* theme +
// accent variant applied to the document root. Stored in the `meta` KV table by
// `services/site-settings.ts` (the only `server-only` wiring).

/**
 * Every selectable theme. These are exactly the skins the web-components library
 * ships (`default` is the global `:root` voice; the rest are scoped under
 * `tc-theme[name="…"]` / `[data-tc-theme="…"]`). The settings picker offers all of
 * them and the branding context applies the chosen one as `data-tc-theme` on the
 * document root, so every `tc-*` element re-skins at once.
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

/**
 * Accent variants every bundled theme ships (web-components `style/themes/…/variants`).
 * A variant swaps only the primary/secondary accent families; `''` keeps the theme's
 * base accents. Applied as `data-tc-variant` next to `data-tc-theme` — the variant
 * selectors are double-attribute scoped, so the `default` theme needs an explicit
 * `data-tc-theme="default"` when a variant is active (the branding context handles it).
 */
export const VARIANT_NAMES = ['', 'ocean', 'forest', 'ember', 'royal'] as const

export type VariantName = (typeof VARIANT_NAMES)[number]

/** Human labels for the accent-variant picker (`''` = the theme's own accents). */
export const VARIANT_LABEL: Record<VariantName, string> = {
    '': 'Theme default',
    ocean: 'Ocean (blue / cyan)',
    forest: 'Forest (green / lime)',
    ember: 'Ember (orange / gold)',
    royal: 'Royal (violet / magenta)',
}

/** Type guard: a request-supplied value is one of the bundled theme names. */
export function isThemeName(value: unknown): value is ThemeName {
    return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value)
}

/** Type guard: a request-supplied value is a bundled accent variant (or `''`). */
export function isVariantName(value: unknown): value is VariantName {
    return typeof value === 'string' && (VARIANT_NAMES as readonly string[]).includes(value)
}

/**
 * The full, effective instance settings. Every field has a default, so a fresh
 * instance (no stored `meta` rows) still resolves to a complete record.
 */
export interface SiteSettings {
    /** The brand wordmark shown in `tc-brand` (sidebar + login logo). */
    primaryText: string
    /** Optional second brand word shown inline after the wordmark in `tc-brand`. */
    secondaryText: string
    /** Optional small label `tc-brand` renders next to the wordmark (e.g. "beta"). */
    brandLabel: string
    /** The brand accent (`tc-brand` dot/mark color), a `#rrggbb` hex. */
    brandColor: string
    /** The active tc-* theme, applied to the document root as `data-tc-theme`. */
    theme: ThemeName
    /** The active accent variant, applied as `data-tc-variant` (`''` = base accents). */
    themeVariant: VariantName
}

/** Built-in defaults for a fresh instance (no stored override yet). */
export const DEFAULT_SETTINGS: SiteSettings = {
    primaryText: 'Task Forge',
    secondaryText: '',
    brandLabel: '',
    brandColor: '#6c5ce7',
    theme: 'default',
    themeVariant: '',
}

/** Map each settings field to its `meta.key`. The DB stores raw strings. */
export const SETTING_KEYS: Record<keyof SiteSettings, string> = {
    primaryText: 'brand_primary_text',
    secondaryText: 'brand_secondary_text',
    brandLabel: 'brand_label',
    brandColor: 'brand_color',
    theme: 'theme',
    themeVariant: 'theme_variant',
}

/** Max length for the free-text brand fields (defensive — keeps the brand sane). */
export const PRIMARY_TEXT_MAX = 40
export const SECONDARY_TEXT_MAX = 40
export const BRAND_LABEL_MAX = 20

/** `#rrggbb` only — what `tc-brand`'s `color` attribute consumes. */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Why a settings patch was rejected (the service maps it to a 400). */
export type SettingsRejection =
    | 'not_object'
    | 'primary_text'
    | 'secondary_text'
    | 'brand_label'
    | 'brand_color'
    | 'theme'
    | 'theme_variant'

/** Result of {@link parseSettingsUpdate}: the normalized patch, or a typed rejection. */
export type SettingsCheck =
    | { ok: true; patch: Partial<SiteSettings> }
    | { ok: false; reason: SettingsRejection; message: string }

/**
 * Validate + normalize an admin-supplied settings patch (the `PUT /api/admin/settings`
 * body). Every field is OPTIONAL — only present, non-undefined fields are validated
 * and returned. Text fields are trimmed and length-capped; `primaryText` may be
 * cleared to `''` to fall back to the built-in wordmark (decodeStored ignores the
 * empty stored value, so the default resurfaces). Pure (no I/O), so unit-testable.
 */
export function parseSettingsUpdate(input: unknown): SettingsCheck {
    if (!input || typeof input !== 'object') {
        return { ok: false, reason: 'not_object', message: 'settings must be an object' }
    }
    const src = input as Record<string, unknown>
    const patch: Partial<SiteSettings> = {}

    if (src.primaryText !== undefined) {
        if (typeof src.primaryText !== 'string' || src.primaryText.trim().length > PRIMARY_TEXT_MAX) {
            return {
                ok: false,
                reason: 'primary_text',
                message: `primaryText must be ≤ ${PRIMARY_TEXT_MAX} characters`,
            }
        }
        patch.primaryText = src.primaryText.trim()
    }

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

    if (src.brandLabel !== undefined) {
        if (typeof src.brandLabel !== 'string' || src.brandLabel.trim().length > BRAND_LABEL_MAX) {
            return {
                ok: false,
                reason: 'brand_label',
                message: `brandLabel must be ≤ ${BRAND_LABEL_MAX} characters`,
            }
        }
        patch.brandLabel = src.brandLabel.trim()
    }

    if (src.brandColor !== undefined) {
        if (typeof src.brandColor !== 'string' || !HEX_COLOR_RE.test(src.brandColor.trim())) {
            return {
                ok: false,
                reason: 'brand_color',
                message: 'brandColor must be a #rrggbb hex color',
            }
        }
        patch.brandColor = src.brandColor.trim().toLowerCase()
    }

    if (src.theme !== undefined) {
        if (!isThemeName(src.theme)) {
            return {
                ok: false,
                reason: 'theme',
                message: `theme must be one of: ${THEME_NAMES.join(', ')}`,
            }
        }
        patch.theme = src.theme
    }

    if (src.themeVariant !== undefined) {
        if (!isVariantName(src.themeVariant)) {
            return {
                ok: false,
                reason: 'theme_variant',
                message: `themeVariant must be one of: ${VARIANT_NAMES.filter(Boolean).join(', ')} (or empty)`,
            }
        }
        patch.themeVariant = src.themeVariant
    }

    return { ok: true, patch }
}

/**
 * Decode a raw `meta` key→value map into a typed partial settings record. The service
 * merges this over {@link DEFAULT_SETTINGS} to get the effective record. Unrelated
 * `meta` rows (migration flags etc.) are ignored — only known keys are read. An empty
 * stored `primaryText`/`brandColor` is treated as unset so the built-in default
 * resurfaces (a brand with no wordmark or an invalid color renders broken).
 */
export function decodeStored(map: Record<string, string>): Partial<SiteSettings> {
    const out: Partial<SiteSettings> = {}
    const primaryText = map[SETTING_KEYS.primaryText]
    if (typeof primaryText === 'string' && primaryText !== '') out.primaryText = primaryText
    const secondaryText = map[SETTING_KEYS.secondaryText]
    if (typeof secondaryText === 'string') out.secondaryText = secondaryText
    const brandLabel = map[SETTING_KEYS.brandLabel]
    if (typeof brandLabel === 'string') out.brandLabel = brandLabel
    const brandColor = map[SETTING_KEYS.brandColor]
    if (typeof brandColor === 'string' && HEX_COLOR_RE.test(brandColor)) out.brandColor = brandColor
    const theme = map[SETTING_KEYS.theme]
    if (isThemeName(theme)) out.theme = theme
    const themeVariant = map[SETTING_KEYS.themeVariant]
    if (isVariantName(themeVariant)) out.themeVariant = themeVariant
    return out
}
