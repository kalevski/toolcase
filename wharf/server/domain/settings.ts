// Pure global-settings decisions — no `server-only`, no I/O, so the branding rules
// behind `services/settings.ts` are unit-testable in isolation (mirrors the other
// `domain/*` modules). This module owns only the *decisions*:
//
//   • the set of valid theme names (must track the bundled `@toolcase/web-components`
//     skins — `tc-theme name="…"` / `[data-tc-theme="…"]`),
//   • field-by-field validation of an owner-supplied settings patch (app name,
//     tagline, theme, brand colour),
//   • the default values + the stored-string ⇄ typed-record (de)coding.
//
// `services/settings.ts` wraps these with the `app_setting` repo + the audit log.
// Safe to import from client AND server — it has no `import 'server-only'` (the
// public `theme`/`appName`/`brandColor` are read client-side by the branding context).

// ── themes (must track the @toolcase/web-components bundled skins) ──────────────

/**
 * Every selectable theme. These are exactly the skins the web-components library
 * ships (`default` is the global `:root` voice; the rest are scoped under
 * `tc-theme[name="…"]` / `[data-tc-theme="…"]`). The settings picker offers all of
 * them and the branding context applies the chosen one as `data-tc-theme` on the
 * document root, so every `tc-*` element re-skins at once.
 */
export const THEME_NAMES = ['default', 'dungeon', 'aurora', 'sunshine', 'neon'] as const

export type ThemeName = (typeof THEME_NAMES)[number]

/** Human labels for the theme picker (the stored value is the lowercase key). */
export const THEME_LABEL: Record<ThemeName, string> = {
    default: 'Default (slate)',
    dungeon: 'Dungeon (gilded fantasy)',
    aurora: 'Aurora (dark)',
    sunshine: 'Sunshine (warm citrus)',
    neon: 'Neon (synthwave)',
}

/** Type guard: a request-supplied value is one of the bundled theme names. */
export function isThemeName(value: unknown): value is ThemeName {
    return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value)
}

// ── the settings record ────────────────────────────────────────────────────────

/**
 * The full, effective instance settings. Every field has a default, so a fresh
 * instance (an empty `app_setting` table) still resolves to a complete record.
 */
export interface SiteSettings {
    /** Product name shown in the brand, the login screen, and the browser tab. */
    appName: string
    /** One-line tagline shown under the brand on the login screen. */
    tagline: string
    /** Active theme — drives every `tc-*` component's skin. */
    theme: ThemeName
    /** Brand accent colour (hex) — the `tc-brand` dot / login logo colour. */
    brandColor: string
    /** Public dashboard base URL (scheme + host + optional port), e.g. `https://wharf.example.com:3000`. */
    baseUrl: string
    /** Wharf Agent API base URL (scheme + host + optional port) containers fetch config from, e.g. `http://wharf-agent:4000`. */
    agentUrl: string
}

/** Built-in defaults for a fresh instance (no `app_setting` rows yet). */
export const DEFAULT_SETTINGS: SiteSettings = {
    appName: 'Wharf',
    tagline: 'Configuration for your Docker containers — env vars, secrets, feature flags.',
    theme: 'default',
    brandColor: '#0d9488',
    baseUrl: 'http://localhost:3000',
    agentUrl: 'http://wharf-agent:4000',
}

/** Map each settings field to its `app_setting.key`. The DB stores raw strings. */
export const SETTING_KEYS: Record<keyof SiteSettings, string> = {
    appName: 'app_name',
    tagline: 'tagline',
    theme: 'theme',
    brandColor: 'brand_color',
    baseUrl: 'base_url',
    agentUrl: 'agent_url',
}

// ── per-field validation ───────────────────────────────────────────────────────

/** Max length for the free-text fields (defensive — keeps the brand/tab sane). */
export const APP_NAME_MAX = 60
export const TAGLINE_MAX = 160
export const URL_MAX = 255

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** True for a `#rgb` / `#rrggbb` hex colour. */
export function isHexColor(value: string): boolean {
    return HEX_COLOR_RE.test(value)
}

/**
 * True for an `http`/`https` URL (host + optional port), e.g. `http://wharf-agent:4000`
 * or `https://wharf.example.com`. Parsed with the standard `URL` (available in both the
 * browser and Node), so it accepts any valid authority + optional port/path.
 */
export function isUrl(value: string): boolean {
    let u: URL
    try {
        u = new URL(value)
    } catch {
        return false
    }
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== ''
}

/** Why a settings patch was rejected (the service maps it to a 400). */
export type SettingsRejection =
    | 'not_object'
    | 'app_name'
    | 'tagline'
    | 'theme'
    | 'brand_color'
    | 'base_url'
    | 'agent_url'

/** Result of {@link parseSettingsUpdate}: the normalized patch, or a typed rejection. */
export type SettingsCheck =
    | { ok: true; patch: Partial<SiteSettings> }
    | { ok: false; reason: SettingsRejection; message: string }

/**
 * Validate + normalize an owner-supplied settings patch (the `PUT /api/admin/settings`
 * body). Every field is OPTIONAL — only the present, non-undefined fields are
 * validated and returned; absent fields are left untouched (the stored/default value
 * stands). Enforces:
 *
 *   • `appName`     — a non-empty string ≤ {@link APP_NAME_MAX} chars (trimmed),
 *   • `tagline`     — a string ≤ {@link TAGLINE_MAX} chars (trimmed; may be empty),
 *   • `theme`       — one of {@link THEME_NAMES},
 *   • `brandColor`  — a `#rgb`/`#rrggbb` hex colour,
 *   • `baseUrl`     — an `http(s)` URL ≤ {@link URL_MAX} chars (host + optional port),
 *   • `agentUrl`    — an `http(s)` URL ≤ {@link URL_MAX} chars (host + optional port).
 *
 * Pure (no I/O), so the field rules are unit-tested directly.
 */
export function parseSettingsUpdate(input: unknown): SettingsCheck {
    if (!input || typeof input !== 'object') {
        return { ok: false, reason: 'not_object', message: 'settings must be an object' }
    }
    const src = input as Record<string, unknown>
    const patch: Partial<SiteSettings> = {}

    if (src.appName !== undefined) {
        if (
            typeof src.appName !== 'string' ||
            src.appName.trim() === '' ||
            src.appName.trim().length > APP_NAME_MAX
        ) {
            return { ok: false, reason: 'app_name', message: `appName must be 1–${APP_NAME_MAX} characters` }
        }
        patch.appName = src.appName.trim()
    }

    if (src.tagline !== undefined) {
        if (typeof src.tagline !== 'string' || src.tagline.trim().length > TAGLINE_MAX) {
            return { ok: false, reason: 'tagline', message: `tagline must be ≤ ${TAGLINE_MAX} characters` }
        }
        patch.tagline = src.tagline.trim()
    }

    if (src.theme !== undefined) {
        if (!isThemeName(src.theme)) {
            return { ok: false, reason: 'theme', message: `theme must be one of: ${THEME_NAMES.join(', ')}` }
        }
        patch.theme = src.theme
    }

    if (src.brandColor !== undefined) {
        if (typeof src.brandColor !== 'string' || !isHexColor(src.brandColor)) {
            return { ok: false, reason: 'brand_color', message: 'brandColor must be a #rgb or #rrggbb hex colour' }
        }
        patch.brandColor = src.brandColor.toLowerCase()
    }

    if (src.baseUrl !== undefined) {
        const v = typeof src.baseUrl === 'string' ? src.baseUrl.trim() : ''
        if (typeof src.baseUrl !== 'string' || v.length > URL_MAX || !isUrl(v)) {
            return { ok: false, reason: 'base_url', message: 'baseUrl must be an http(s) URL (host + optional port)' }
        }
        patch.baseUrl = v
    }

    if (src.agentUrl !== undefined) {
        const v = typeof src.agentUrl === 'string' ? src.agentUrl.trim() : ''
        if (typeof src.agentUrl !== 'string' || v.length > URL_MAX || !isUrl(v)) {
            return { ok: false, reason: 'agent_url', message: 'agentUrl must be an http(s) URL (host + optional port)' }
        }
        patch.agentUrl = v
    }

    return { ok: true, patch }
}

// ── stored-string ⇄ typed-record decoding ──────────────────────────────────────

/**
 * Decode a raw `app_setting` key→value map into a typed partial settings record,
 * silently dropping any stored value that no longer validates (defensive — a theme
 * that was removed from the library, say). The service merges this over
 * {@link DEFAULT_SETTINGS} to get the effective record.
 */
export function decodeStored(map: Record<string, string>): Partial<SiteSettings> {
    const out: Partial<SiteSettings> = {}

    const appName = map[SETTING_KEYS.appName]
    if (typeof appName === 'string' && appName.trim() !== '') out.appName = appName

    const tagline = map[SETTING_KEYS.tagline]
    if (typeof tagline === 'string') out.tagline = tagline

    const theme = map[SETTING_KEYS.theme]
    if (isThemeName(theme)) out.theme = theme

    const brandColor = map[SETTING_KEYS.brandColor]
    if (typeof brandColor === 'string' && isHexColor(brandColor)) out.brandColor = brandColor

    const baseUrl = map[SETTING_KEYS.baseUrl]
    if (typeof baseUrl === 'string' && isUrl(baseUrl)) out.baseUrl = baseUrl

    const agentUrl = map[SETTING_KEYS.agentUrl]
    if (typeof agentUrl === 'string' && isUrl(agentUrl)) out.agentUrl = agentUrl

    return out
}
