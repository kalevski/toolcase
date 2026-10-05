// Every assumption about the upstream mail server (Stalwart, unverified) that is
// NOT plain RFC 8620/8621 lives here, so a different server or a fix upstream is
// a one-file change. Nothing outside this file should special-case a server.

import type { Mailbox, MailboxRole } from './types'

export const quirks = {
    /** EventSource `types` parameter. RFC 8620 allows `*`. */
    eventSourceTypes: '*',
    /** Server ping interval in seconds requested on the EventSource. */
    eventSourcePing: 30,
    /**
     * Some servers report roles in upper case or omit them for well-known names.
     * We lower-case the role and, only when no mailbox at all carries a given
     * role, fall back to a case-insensitive name match.
     */
    roleNameFallbacks: {
        inbox: ['inbox'],
        drafts: ['drafts', 'draft'],
        sent: ['sent', 'sent items', 'sent mail'],
        junk: ['junk', 'spam', 'junk mail'],
        trash: ['trash', 'deleted items', 'bin'],
        archive: ['archive', 'archives'],
    } as Record<string, string[]>,
    /** Page size for Email/query. Must stay below the server's maxObjectsInGet. */
    pageSize: 40,
    /**
     * Max body bytes asked for when quoting a message in a reply. Servers cap
     * this themselves too.
     */
    quoteBodyBytes: 64 * 1024,
}

export function normaliseRole(role: unknown): MailboxRole {
    return typeof role === 'string' && role ? (role.toLowerCase() as MailboxRole) : null
}

/** Find the mailbox for a role, tolerating servers that leave roles unset. */
export function mailboxForRole(mailboxes: Mailbox[], role: string): Mailbox | undefined {
    const byRole = mailboxes.find((m) => m.role === role)
    if (byRole) return byRole
    const names = quirks.roleNameFallbacks[role]
    if (!names) return undefined
    return mailboxes.find((m) => !m.parentId && names.includes(m.name.toLowerCase()))
}
