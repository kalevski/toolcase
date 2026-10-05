import { locale, t } from '../i18n'
import type { EmailAddress } from '../jmap/types'

export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n < 0) return t('bytes.b', { n: 0 })
    if (n < 1024) return t('bytes.b', { n })
    if (n < 1024 * 1024) return t('bytes.kb', { n: Math.round(n / 1024) })
    if (n < 1024 * 1024 * 1024) return t('bytes.mb', { n: (n / 1024 / 1024).toFixed(1) })
    return t('bytes.gb', { n: (n / 1024 / 1024 / 1024).toFixed(1) })
}

/** Short list-row date: time today, day+month this year, full date otherwise. */
export function formatShortDate(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const loc = locale()
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
    }
    if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
    }
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatLongDate(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatAddress(a: EmailAddress): string {
    return a.name ? `${a.name} <${a.email}>` : a.email
}

export function displayName(a: EmailAddress | undefined | null): string {
    if (!a) return ''
    return a.name || a.email
}

export function formatAddressList(list: EmailAddress[] | null | undefined): string {
    return (list ?? []).map(formatAddress).join(', ')
}
