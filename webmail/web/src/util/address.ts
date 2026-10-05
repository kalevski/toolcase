import type { EmailAddress } from '../jmap/types'
import { isEmail } from './safe'

/** Parse "Name <a@b.c>", "<a@b.c>" or "a@b.c". Returns null when invalid. */
export function parseAddress(input: string): EmailAddress | null {
    const s = input.trim().replace(/[,;]+$/, '').trim()
    if (!s) return null
    const m = /^(.*)<([^<>]+)>$/.exec(s)
    if (m) {
        const email = m[2].trim()
        const name = m[1].trim().replace(/^"|"$/g, '').trim()
        return isEmail(email) ? { name: name || null, email } : null
    }
    return isEmail(s) ? { name: null, email: s } : null
}

/** Split pasted text into address tokens on commas, semicolons and newlines. */
export function splitAddresses(input: string): string[] {
    const out: string[] = []
    let cur = ''
    let quoted = false
    let angle = false
    for (const ch of input) {
        if (ch === '"') quoted = !quoted
        if (ch === '<') angle = true
        if (ch === '>') angle = false
        if (!quoted && !angle && (ch === ',' || ch === ';' || ch === '\n')) {
            if (cur.trim()) out.push(cur.trim())
            cur = ''
            continue
        }
        cur += ch
    }
    if (cur.trim()) out.push(cur.trim())
    return out
}

export function sameAddress(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
}
