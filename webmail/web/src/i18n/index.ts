import { en, type MessageKey, type Messages } from './en'

// Only English ships in v1. The locale is picked from the mailbox preference,
// then the domain default, then the browser; anything unknown falls back to en.
const catalogues: Record<string, Messages> = { en }

export const LANGUAGES: { code: string; label: string }[] = [{ code: 'en', label: 'English' }]

let active: Messages = en
let activeCode = 'en'

export function pickLocale(...candidates: (string | undefined | null)[]): string {
    const all = [...candidates, ...(typeof navigator !== 'undefined' ? navigator.languages : [])]
    for (const c of all) {
        if (!c) continue
        const base = c.toLowerCase().split('-')[0]
        if (catalogues[base]) return base
    }
    return 'en'
}

export function setLocale(code: string): void {
    activeCode = catalogues[code] ? code : 'en'
    active = catalogues[activeCode]
    document.documentElement.lang = activeCode
}

export function locale(): string {
    return activeCode
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
    const template = active[key] ?? en[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (m, name: string) =>
        name in params ? String(params[name]) : m,
    )
}

export type { MessageKey }
