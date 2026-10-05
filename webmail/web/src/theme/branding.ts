// Applies per-domain branding and the mailbox's own appearance preference.
//
// Branding is DATA: a theme name checked against the bundled list, and an accent
// checked as a hex colour. Nothing from it is ever written as CSS text or HTML.
// The bundled tc-* themes each have a fixed mode, so a mailbox preference that
// disagrees with the domain theme's mode swaps to the neutral theme of the other
// mode while keeping the domain's accent (the accent is the brand; the mode is
// the reader's).

import type { Branding, ThemePref } from '../api/session'
import { hex6, hexToRgb, isHexColor, luminance } from '../util/safe'

/**
 * A domain's `theme` is one of the platform's theme variants (the colour families the dashboard offers in its
 * branding tab). The mail app wears the dashboard's own blueprint theme in that variant; a reader who prefers dark
 * gets the matching dark theme in the same variant.
 */
export const THEME_VARIANTS = [
    'ocean',
    'indigo',
    'royal',
    'twilight',
    'forest',
    'mint',
    'crimson',
    'rose',
    'ember',
    'sunset',
    'slate',
] as const

export const DEFAULT_VARIANT = 'ocean'

const THEME_FOR_MODE: Record<'light' | 'dark', string> = { light: 'blueprint', dark: 'aurora' }

const ACCENT_VARS = [
    '--tc-app-accent',
    '--tc-app-accent-hover',
    '--tc-app-accent-gradient',
    '--tc-app-accent-contrast',
    '--tc-accent',
    '--tc-accent-fg',
    '--bs-primary',
    '--bs-primary-rgb',
    '--bs-primary-contrast',
    '--bs-link-color',
    '--bs-link-hover-color',
    '--bs-focus-ring-color',
]

export function systemMode(): 'light' | 'dark' {
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
        return 'light'
    }
}

export function resolveTheme(brandTheme: string, pref: ThemePref): { name: string; variant: string; mode: 'light' | 'dark' } {
    const variant = (THEME_VARIANTS as readonly string[]).includes(brandTheme) ? brandTheme : DEFAULT_VARIANT
    const mode = pref === 'system' ? systemMode() : pref
    return { name: THEME_FOR_MODE[mode], variant, mode }
}

export function applyAppearance(branding: Branding, pref: ThemePref): void {
    const root = document.documentElement
    const { name, variant, mode } = resolveTheme(branding.theme, pref)
    root.setAttribute('data-tc-theme', name)
    root.setAttribute('data-tc-variant', variant)
    root.dataset.mode = mode
    root.style.colorScheme = mode

    for (const v of ACCENT_VARS) root.style.removeProperty(v)
    if (isHexColor(branding.accent)) {
        const accent = hex6(branding.accent)
        const [r, g, b] = hexToRgb(accent)
        const ink = luminance(accent) > 0.45 ? '#111827' : '#ffffff'
        const hover = `color-mix(in srgb, ${accent} 82%, ${mode === 'dark' ? '#ffffff' : '#000000'})`
        root.style.setProperty('--tc-app-accent', accent)
        root.style.setProperty('--tc-app-accent-hover', hover)
        root.style.setProperty('--tc-app-accent-gradient', `linear-gradient(135deg, ${accent}, ${hover})`)
        root.style.setProperty('--tc-app-accent-contrast', ink)
        root.style.setProperty('--tc-accent', accent)
        root.style.setProperty('--tc-accent-fg', accent)
        root.style.setProperty('--bs-primary', accent)
        root.style.setProperty('--bs-primary-rgb', `${r}, ${g}, ${b}`)
        root.style.setProperty('--bs-primary-contrast', ink)
        root.style.setProperty('--bs-link-color', accent)
        root.style.setProperty('--bs-link-hover-color', hover)
        root.style.setProperty('--bs-focus-ring-color', `rgba(${r}, ${g}, ${b}, 0.35)`)
    }
}

export function applyTitle(branding: Branding, unread = 0): void {
    const name = branding.name || 'Webmail'
    document.title = unread > 0 ? `(${unread}) ${name}` : name
}
