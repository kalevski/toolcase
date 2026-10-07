import { api } from './client'
import type { JmapSession } from '../jmap/types'

export type FooterLink = { label: string; url: string }

export type Branding = {
    known: boolean
    domain: string
    name: string
    theme: string
    accent: string
    loginTitle: string
    loginMessage: string
    supportEmail: string
    supportUrl: string
    footerLinks: FooterLink[]
    defaultLanguage: string
    allowUserAccent: boolean
    /** Who may sign in on this host: any mailbox, or only addresses of `domain`. */
    signInScope: 'any' | 'domain'
    /** The wordmark: its bold first part, its lighter second part and a small badge above it ('' = none). */
    brandPrimary: string
    brandSecondary: string
    brandBadge: string
}

export type ThemePref = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'
export type Layout = 'list' | 'right' | 'bottom'
export type ImagePolicy = 'ask' | 'always' | 'never'

export type Prefs = {
    language?: string
    theme: ThemePref
    density: Density
    layout: Layout
    imagePolicy: ImagePolicy
    trustedSenders: string[]
}

export type Limits = { maxUploadBytes: number; maxCallsInRequest: number; maxBodyBytes: number }

export type SessionInfo = {
    address: string
    sessionId: string
    csrf: string
    jmap: JmapSession
    branding: Branding
    prefs: Prefs
    limits: Limits
}

export type ActiveSession = {
    id: string
    current: boolean
    createdAt: string
    lastUsedAt: string
    ip: string
    userAgent: string
}

export const DEFAULT_PREFS: Prefs = {
    theme: 'system',
    density: 'comfortable',
    layout: 'right',
    imagePolicy: 'ask',
    trustedSenders: [],
}

export const NEUTRAL_BRANDING: Branding = {
    known: false,
    domain: '',
    name: 'Webmail',
    theme: 'ocean',
    accent: '',
    loginTitle: '',
    loginMessage: '',
    supportEmail: '',
    supportUrl: '',
    footerLinks: [],
    defaultLanguage: '',
    allowUserAccent: false,
    signInScope: 'any',
    brandPrimary: '',
    brandSecondary: '',
    brandBadge: '',
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback
}

/** Coerce whatever the server stored into a well-formed prefs object. */
export function normalizePrefs(raw: Partial<Prefs> | null | undefined): Prefs {
    const p = raw ?? {}
    return {
        language: typeof p.language === 'string' && p.language ? p.language : undefined,
        theme: oneOf(p.theme, ['light', 'dark', 'system'] as const, DEFAULT_PREFS.theme),
        density: oneOf(p.density, ['comfortable', 'compact'] as const, DEFAULT_PREFS.density),
        layout: oneOf(p.layout, ['list', 'right', 'bottom'] as const, DEFAULT_PREFS.layout),
        imagePolicy: oneOf(p.imagePolicy, ['ask', 'always', 'never'] as const, 'ask'),
        trustedSenders: Array.isArray(p.trustedSenders)
            ? p.trustedSenders.filter((s): s is string => typeof s === 'string')
            : [],
    }
}

function str(v: unknown): string {
    return typeof v === 'string' ? v : ''
}

/** Branding is data the platform pushed; keep only the fields and types we use. */
export function normalizeBranding(raw: Partial<Branding> | null | undefined): Branding {
    if (!raw || typeof raw !== 'object') return NEUTRAL_BRANDING
    return {
        known: raw.known === true,
        domain: str(raw.domain),
        name: str(raw.name) || NEUTRAL_BRANDING.name,
        theme: str(raw.theme) || 'default',
        accent: str(raw.accent),
        loginTitle: str(raw.loginTitle).slice(0, 280),
        loginMessage: str(raw.loginMessage).slice(0, 280),
        supportEmail: str(raw.supportEmail),
        supportUrl: str(raw.supportUrl),
        footerLinks: Array.isArray(raw.footerLinks)
            ? raw.footerLinks
                  .filter((l) => l && typeof l === 'object')
                  .map((l) => ({ label: str(l.label), url: str(l.url) }))
                  .filter((l) => l.label && l.url)
                  .slice(0, 12)
            : [],
        defaultLanguage: str(raw.defaultLanguage),
        allowUserAccent: raw.allowUserAccent === true,
        signInScope: raw.signInScope === 'domain' && str(raw.domain) !== '' ? 'domain' : 'any',
        brandPrimary: str(raw.brandPrimary).slice(0, 40),
        brandSecondary: str(raw.brandSecondary).slice(0, 40),
        brandBadge: str(raw.brandBadge).slice(0, 40),
    }
}

/** The branding of the host this page is served on (the address the platform gave the domain's webmail). */
export async function fetchBranding(signal?: AbortSignal): Promise<Branding> {
    const raw = await api<Branding>('/api/branding', {
        signal,
        allow401: true,
    })
    return normalizeBranding(raw)
}

export async function fetchSession(): Promise<SessionInfo | null> {
    try {
        const s = await api<SessionInfo>('/api/session', { allow401: true })
        return {
            ...s,
            branding: normalizeBranding(s.branding),
            prefs: normalizePrefs(s.prefs),
            limits: {
                maxUploadBytes: s.limits?.maxUploadBytes || 25 * 1024 * 1024,
                maxCallsInRequest: s.limits?.maxCallsInRequest || 32,
                maxBodyBytes: s.limits?.maxBodyBytes || 1024 * 1024,
            },
        }
    } catch (err) {
        if ((err as { status?: number }).status === 401) return null
        throw err
    }
}

export function login(email: string, password: string, remember: boolean): Promise<unknown> {
    return api('/api/login', {
        method: 'POST',
        body: { email, password, remember },
        noCsrf: true,
        allow401: true,
    })
}

export function logout(): Promise<unknown> {
    return api('/api/logout', { method: 'POST', allow401: true })
}

export function listSessions(): Promise<ActiveSession[]> {
    return api<ActiveSession[]>('/api/sessions')
}

export function endSession(id: string): Promise<unknown> {
    return api(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function savePrefs(prefs: Prefs): Promise<Prefs> {
    const stored = await api<Prefs>('/api/prefs', { method: 'PUT', body: prefs })
    return normalizePrefs(stored ?? prefs)
}

export function changePassword(current: string, next: string): Promise<unknown> {
    return api('/api/password', { method: 'POST', body: { current, next }, allow401: true })
}
