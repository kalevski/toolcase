// Pure domain layer for access lists (quaykeeper_better.md C1) — named IP allow/deny
// + basic-auth policies a proxy, redirect or dead host references via
// `access_list: <name>`. Mirrors the daemon's `config.AccessList` JSON 1:1 and
// front-runs its validation rules, like `domain/routing.ts` does for the other
// routing resources.
//
// SECRET HANDLING: passwords never pass through this module. The daemon masks
// hashes on GET (users carry `has_password` only), fragments Quaykeeper renders carry
// usernames only (the daemon merges existing hashes forward on replace), and
// plaintext goes exclusively through the dedicated password endpoint.

import type { Check } from './routing'

/** nginx `satisfy` — all (default: rules AND auth) or any (first pass grants). */
export type SatisfyMode = 'all' | 'any'

/** One ordered allow/deny entry: exactly one side set to an IP, a CIDR, or "all". */
export interface AccessRule {
    allow?: string
    deny?: string
}

/** One basic-auth account. `has_password` is the daemon's masked read shape. */
export interface AccessListUser {
    username: string
    /** Read-only: whether a password has been set (the hash never crosses the wire). */
    has_password?: boolean
}

/** A named access policy (own namespace, [A-Za-z0-9_]+ like upstreams). */
export interface AccessList {
    name: string
    /** Absent = all. */
    satisfy?: SatisfyMode
    /** Forward the client's Authorization header upstream (default: consume it). */
    pass_auth?: boolean
    users?: AccessListUser[]
    rules?: AccessRule[]
}

const NAME_RE = /^[A-Za-z0-9_]+$/
const USERNAME_RE = /^[\x21-\x39\x3b-\x7e]+$/ // printable ASCII minus ':' (0x3a) and space

const reject = <T>(reason: string, message: string): Check<T> => ({ ok: false, reason, message })

function asObject(input: unknown): Record<string, unknown> | null {
    return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null
}

/** Whether a rule value is an IPv4/IPv6 address, a CIDR of either, or "all". */
export function isRuleAddr(v: string): boolean {
    if (v === 'all') return true
    let host = v
    if (v.includes('/')) {
        const [h, prefix, ...rest] = v.split('/')
        if (rest.length > 0 || !/^\d{1,3}$/.test(prefix)) return false
        const bits = Number(prefix)
        host = h
        const max = h.includes(':') ? 128 : 32
        if (bits > max) return false
    }
    if (host.includes(':')) {
        // IPv6: hex groups + at most one '::'. Light-shape check — the daemon
        // (netip) is the final authority.
        if (!/^[0-9a-fA-F:]+$/.test(host)) return false
        if ((host.match(/::/g) ?? []).length > 1) return false
        return host.split(':').filter(Boolean).every((g) => g.length <= 4)
    }
    const quads = host.split('.')
    if (quads.length !== 4) return false
    return quads.every((q) => /^\d{1,3}$/.test(q) && Number(q) <= 255)
}

/**
 * Validate + normalize an access list (the `POST /api/routing/access-lists`
 * body), mirroring the daemon's rules: identifier name, satisfy enum, printable
 * colon-less usernames (they become htpasswd line prefixes), and ordered rules
 * that each set exactly one of allow/deny to an IP / CIDR / "all". Password
 * material is rejected outright — it must go through the password endpoint.
 */
export function parseAccessList(input: unknown): Check<AccessList> {
    const o = asObject(input)
    if (!o) return reject('not_object', 'access list must be an object')

    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) return reject('name_required', 'access list name is required')
    if (!NAME_RE.test(name)) return reject('bad_name', 'name must match [A-Za-z0-9_]+')

    const satisfy = o.satisfy === undefined || o.satisfy === null || o.satisfy === '' ? 'all' : o.satisfy
    if (satisfy !== 'all' && satisfy !== 'any') {
        return reject('bad_satisfy', 'satisfy must be all or any')
    }

    const users: AccessListUser[] = []
    const seenUsers = new Set<string>()
    for (const raw of Array.isArray(o.users) ? o.users : []) {
        const u = asObject(raw)
        if (!u) return reject('bad_user', 'each user must be an object')
        // Plaintext or hashes never ride the fragment path from Quaykeeper.
        if ('password' in u || 'password_hash' in u) {
            return reject('password_in_fragment', 'set passwords via the dedicated password endpoint, never in the list body')
        }
        const username = typeof u.username === 'string' ? u.username.trim() : ''
        if (!username) return reject('username_required', 'every user needs a username')
        if (!USERNAME_RE.test(username)) {
            return reject('bad_username', `username ${username} must be printable ASCII without ':' or spaces`)
        }
        if (seenUsers.has(username)) return reject('duplicate_user', `duplicate user ${username}`)
        seenUsers.add(username)
        users.push({ username })
    }

    const rules: AccessRule[] = []
    for (const raw of Array.isArray(o.rules) ? o.rules : []) {
        const r = asObject(raw)
        if (!r) return reject('bad_rule', 'each rule must be an object')
        const allow = typeof r.allow === 'string' ? r.allow.trim() : ''
        const deny = typeof r.deny === 'string' ? r.deny.trim() : ''
        if (!allow === !deny) return reject('bad_rule', 'each rule must set exactly one of allow or deny')
        const v = allow || deny
        if (!isRuleAddr(v)) return reject('bad_rule_addr', `${v} is not an IP, a CIDR, or "all"`)
        rules.push(allow ? { allow } : { deny })
    }

    const value: AccessList = { name }
    if (satisfy === 'any') value.satisfy = 'any'
    if (o.pass_auth === true) value.pass_auth = true
    if (users.length) value.users = users
    if (rules.length) value.rules = rules
    return { ok: true, value }
}

/**
 * Render the `access_lists: [ … ]` fragment for `POST /access-lists` (exactly
 * one list). Usernames render WITHOUT password material — the daemon carries
 * existing hashes forward on a replace-by-name write.
 */
export function renderAccessListFragment(l: AccessList): string {
    const lines: string[] = [
        '# generated by Quaykeeper; managed automatically, do not edit by hand.',
        'access_lists:',
        `  - name: ${l.name}`,
    ]
    if (l.satisfy === 'any') lines.push('    satisfy: any')
    if (l.pass_auth) lines.push('    pass_auth: true')
    if (l.users?.length) {
        lines.push('    users:')
        for (const u of l.users) lines.push(`      - username: ${JSON.stringify(u.username)}`)
    }
    if (l.rules?.length) {
        lines.push('    rules:')
        for (const r of l.rules) {
            if (r.allow) lines.push(`      - allow: ${JSON.stringify(r.allow)}`)
            else lines.push(`      - deny: ${JSON.stringify(r.deny)}`)
        }
    }
    return lines.join('\n') + '\n'
}
