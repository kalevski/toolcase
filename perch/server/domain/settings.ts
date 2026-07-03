// Pure global-settings decisions — no `server-only`, no I/O, so the branding +
// custom-domain-ingress rules behind `services/settings.ts` are unit-testable in
// isolation (mirrors `domain/admin.ts`). This module owns only the *decisions*:
//
//   • the set of valid theme names (must track the bundled `@toolcase/web-components`
//     skins — `tc-theme name="…"` / `[data-tc-theme="…"]`),
//   • field-by-field validation of an owner-supplied settings patch (app name,
//     tagline, theme, brand colour, ingress IPv4/IPv6),
//   • the default values + the stored-string ⇄ typed-record (de)coding.
//
// `services/settings.ts` wraps these with the `app_setting` repo, the env fallback
// for the ingress IPs, and the audit log. Safe to import from client AND server —
// it has no `import 'server-only'` (the public `theme`/`appName` are read client-side).
//
// See notes/static-hosting-app-design.md §6, §10, §13.

// ── themes (must track the @toolcase/web-components bundled skins) ──────────────

/**
 * Every selectable theme. These are exactly the skins the web-components library
 * ships (`default` is the global `:root` voice; the rest are scoped under
 * `tc-theme[name="…"]` / `[data-tc-theme="…"]`). The admin picker offers all of
 * them and the client applies the chosen one as `data-tc-theme` on the document
 * root, so every `tc-*` element re-skins at once.
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
 * Accent variants — every bundled theme ships all four (see the library's
 * `style/themes/VARIANTS.md`). A variant swaps only the primary/secondary
 * accents; `''` means "the theme's base accents". Applied as `data-tc-variant`
 * next to `data-tc-theme` on the document root.
 */
export const THEME_VARIANTS = ['ocean', 'forest', 'ember', 'royal'] as const

export type ThemeVariant = (typeof THEME_VARIANTS)[number]

/** Human labels for the variant half of the theme picker. */
export const THEME_VARIANT_LABEL: Record<ThemeVariant, string> = {
    ocean: 'Ocean (blue/cyan)',
    forest: 'Forest (green/lime)',
    ember: 'Ember (orange/gold)',
    royal: 'Royal (violet/magenta)',
}

/** Type guard: a request-supplied value is a bundled accent variant. */
export function isThemeVariant(value: unknown): value is ThemeVariant {
    return typeof value === 'string' && (THEME_VARIANTS as readonly string[]).includes(value)
}

// ── the settings record ────────────────────────────────────────────────────────

/**
 * The full, effective instance settings. Every field has a default, so a fresh
 * instance (an empty `app_setting` table) still resolves to a complete record.
 * `ingressIpv4`/`ingressIpv6` may be empty — that means "fall back to the env
 * default" at the service layer, and an empty IPv4 makes custom-domain
 * verification unavailable (it has no IP to compare a resolved A-record against).
 */
export interface SiteSettings {
    /** Product name shown in the brand, the login screen, and the browser tab. */
    appName: string
    /** One-line tagline shown under the brand on the login screen. */
    tagline: string
    /** Optional second brand word shown inline after the app name in `tc-brand`. */
    secondaryText: string
    /** Optional stamp badge text shown over the sidebar brand (`tc-stamp`; empty = no stamp). */
    stampText: string
    /** Active theme — drives every `tc-*` component's skin. */
    theme: ThemeName
    /** Accent variant of the active theme (`''` = the theme's base accents). */
    themeVariant: ThemeVariant | ''
    /** Brand accent colour (hex) — the `tc-brand` dot / login logo colour. */
    brandColor: string
    /** Public ingress IPv4 a custom domain must point at (the A-record target). */
    ingressIpv4: string
    /** Public ingress IPv6 handed out for the optional AAAA record. */
    ingressIpv6: string
}

/** Built-in defaults for a fresh instance (no `app_setting` rows yet). */
export const DEFAULT_SETTINGS: SiteSettings = {
    appName: 'Perch',
    tagline: 'Deploy a branch of your GitHub repository as a static website.',
    secondaryText: '',
    stampText: '',
    theme: 'default',
    themeVariant: '',
    brandColor: '#0ea5e9',
    ingressIpv4: '',
    ingressIpv6: '',
}

/** Map each settings field to its `app_setting.key`. The DB stores raw strings. */
export const SETTING_KEYS: Record<keyof SiteSettings, string> = {
    appName: 'app_name',
    tagline: 'tagline',
    secondaryText: 'secondary_text',
    stampText: 'stamp_text',
    theme: 'theme',
    themeVariant: 'theme_variant',
    brandColor: 'brand_color',
    ingressIpv4: 'ingress_ipv4',
    ingressIpv6: 'ingress_ipv6',
}

// ── per-field validation ───────────────────────────────────────────────────────

/** Max length for the free-text fields (defensive — keeps the brand/tab sane). */
export const APP_NAME_MAX = 60
export const TAGLINE_MAX = 160
export const SECONDARY_TEXT_MAX = 40
export const STAMP_TEXT_MAX = 24

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
// Permissive IPv6 shape check (full, compressed `::`, and IPv4-mapped tails). Not
// a canonicaliser — just rejects obviously-malformed input before it's stored.
const IPV6_RE = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})$|^(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})$|^(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})$|^(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})$|^(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})$|^([0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6}))$|^(:((:[0-9a-fA-F]{1,4}){1,7}|:))$/
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** True for a syntactically valid dotted-quad IPv4 (each octet 0–255). */
export function isIpv4(value: string): boolean {
    const m = IPV4_RE.exec(value)
    if (!m) return false
    return m.slice(1).every((octet) => {
        const n = Number(octet)
        return n >= 0 && n <= 255 && String(n) === octet // no leading zeros
    })
}

/** True for a plausibly-shaped IPv6 literal (compressed or full). */
export function isIpv6(value: string): boolean {
    return IPV6_RE.test(value)
}

/** True for a `#rgb` / `#rrggbb` hex colour. */
export function isHexColor(value: string): boolean {
    return HEX_COLOR_RE.test(value)
}

/** Why a settings patch was rejected (the service maps it to a 400). */
export type SettingsRejection =
    | 'not_object'
    | 'app_name'
    | 'tagline'
    | 'secondary_text'
    | 'stamp_text'
    | 'theme'
    | 'theme_variant'
    | 'brand_color'
    | 'ingress_ipv4'
    | 'ingress_ipv6'

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
 *   • `ingressIpv4` — a dotted-quad IPv4, OR empty (= "clear → fall back to env"),
 *   • `ingressIpv6` — an IPv6 literal, OR empty.
 *
 * The empty-string-allowed IPs are how the owner *clears* an override back to the
 * env default. Pure (no I/O), so the field rules are unit-tested directly.
 */
export function parseSettingsUpdate(input: unknown): SettingsCheck {
    if (!input || typeof input !== 'object') {
        return { ok: false, reason: 'not_object', message: 'settings must be an object' }
    }
    const src = input as Record<string, unknown>
    const patch: Partial<SiteSettings> = {}

    if (src.appName !== undefined) {
        if (typeof src.appName !== 'string' || src.appName.trim() === '' || src.appName.trim().length > APP_NAME_MAX) {
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

    if (src.secondaryText !== undefined) {
        if (typeof src.secondaryText !== 'string' || src.secondaryText.trim().length > SECONDARY_TEXT_MAX) {
            return { ok: false, reason: 'secondary_text', message: `secondaryText must be ≤ ${SECONDARY_TEXT_MAX} characters` }
        }
        patch.secondaryText = src.secondaryText.trim()
    }

    if (src.stampText !== undefined) {
        if (typeof src.stampText !== 'string' || src.stampText.trim().length > STAMP_TEXT_MAX) {
            return { ok: false, reason: 'stamp_text', message: `stampText must be ≤ ${STAMP_TEXT_MAX} characters` }
        }
        patch.stampText = src.stampText.trim()
    }

    if (src.theme !== undefined) {
        if (!isThemeName(src.theme)) {
            return { ok: false, reason: 'theme', message: `theme must be one of: ${THEME_NAMES.join(', ')}` }
        }
        patch.theme = src.theme
    }

    if (src.themeVariant !== undefined) {
        if (src.themeVariant !== '' && !isThemeVariant(src.themeVariant)) {
            return {
                ok: false,
                reason: 'theme_variant',
                message: `themeVariant must be one of: ${THEME_VARIANTS.join(', ')} (or empty for the base accents)`,
            }
        }
        patch.themeVariant = src.themeVariant as ThemeVariant | ''
    }

    if (src.brandColor !== undefined) {
        if (typeof src.brandColor !== 'string' || !isHexColor(src.brandColor)) {
            return { ok: false, reason: 'brand_color', message: 'brandColor must be a #rgb or #rrggbb hex colour' }
        }
        patch.brandColor = src.brandColor.toLowerCase()
    }

    if (src.ingressIpv4 !== undefined) {
        if (typeof src.ingressIpv4 !== 'string') {
            return { ok: false, reason: 'ingress_ipv4', message: 'ingressIpv4 must be a string' }
        }
        const v = src.ingressIpv4.trim()
        if (v !== '' && !isIpv4(v)) {
            return { ok: false, reason: 'ingress_ipv4', message: 'ingressIpv4 must be a valid IPv4 address (or empty)' }
        }
        patch.ingressIpv4 = v
    }

    if (src.ingressIpv6 !== undefined) {
        if (typeof src.ingressIpv6 !== 'string') {
            return { ok: false, reason: 'ingress_ipv6', message: 'ingressIpv6 must be a string' }
        }
        const v = src.ingressIpv6.trim()
        if (v !== '' && !isIpv6(v)) {
            return { ok: false, reason: 'ingress_ipv6', message: 'ingressIpv6 must be a valid IPv6 address (or empty)' }
        }
        patch.ingressIpv6 = v
    }

    return { ok: true, patch }
}

// ── stored-string ⇄ typed-record decoding ──────────────────────────────────────

/**
 * Decode a raw `app_setting` key→value map into a typed partial settings record,
 * silently dropping any stored value that no longer validates (defensive — a theme
 * that was removed from the library, say). The service merges this over
 * {@link DEFAULT_SETTINGS} and the env ingress fallback to get the effective record.
 */
export function decodeStored(map: Record<string, string>): Partial<SiteSettings> {
    const out: Partial<SiteSettings> = {}
    const appName = map[SETTING_KEYS.appName]
    if (typeof appName === 'string' && appName.trim() !== '') out.appName = appName

    const tagline = map[SETTING_KEYS.tagline]
    if (typeof tagline === 'string') out.tagline = tagline

    const secondaryText = map[SETTING_KEYS.secondaryText]
    if (typeof secondaryText === 'string') out.secondaryText = secondaryText

    const stampText = map[SETTING_KEYS.stampText]
    if (typeof stampText === 'string') out.stampText = stampText

    const theme = map[SETTING_KEYS.theme]
    if (isThemeName(theme)) out.theme = theme

    const themeVariant = map[SETTING_KEYS.themeVariant]
    if (themeVariant === '' || isThemeVariant(themeVariant)) out.themeVariant = themeVariant

    const brandColor = map[SETTING_KEYS.brandColor]
    if (typeof brandColor === 'string' && isHexColor(brandColor)) out.brandColor = brandColor

    const ipv4 = map[SETTING_KEYS.ingressIpv4]
    if (typeof ipv4 === 'string' && (ipv4 === '' || isIpv4(ipv4))) out.ingressIpv4 = ipv4

    const ipv6 = map[SETTING_KEYS.ingressIpv6]
    if (typeof ipv6 === 'string' && (ipv6 === '' || isIpv6(ipv6))) out.ingressIpv6 = ipv6

    return out
}
