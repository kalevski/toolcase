// Validators for values that come from data (branding, mail headers) before
// they reach an attribute. Pure; unit-tested in test/safe.test.ts.

export function isHttpUrl(value: unknown): value is string {
    if (typeof value !== 'string' || !value) return false
    try {
        const u = new URL(value)
        return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname
    } catch {
        return false
    }
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function isHexColor(value: unknown): value is string {
    return typeof value === 'string' && HEX.test(value)
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/

export function isEmail(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 254 && EMAIL.test(value)
}

/** The domain part of a partially typed address, or '' when there is none yet. */
export function domainOf(address: string): string {
    const at = address.lastIndexOf('@')
    if (at < 1) return ''
    const d = address.slice(at + 1).trim().toLowerCase()
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : ''
}

/** Normalise a hex colour to #rrggbb. */
export function hex6(value: string): string {
    if (value.length === 4) {
        return '#' + [...value.slice(1)].map((c) => c + c).join('').toLowerCase()
    }
    return value.toLowerCase()
}

export function hexToRgb(value: string): [number, number, number] {
    const h = hex6(value).slice(1)
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG relative luminance. */
export function luminance(value: string): number {
    const [r, g, b] = hexToRgb(value).map((c) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Which SPF/DKIM/DMARC checks an Authentication-Results header (RFC 8601)
 * reports as failed. Only failures are surfaced; "none" / "neutral" are not.
 */
export function failedAuthChecks(header: unknown): string[] {
    if (typeof header !== 'string' || !header) return []
    const out = new Set<string>()
    const re = /\b(spf|dkim|dmarc)\s*=\s*(fail|softfail|permerror)\b/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(header))) out.add(m[1].toUpperCase())
    return [...out]
}
