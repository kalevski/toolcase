// Mail operations built on JmapClient. Each function is one round trip.

import { api } from './client'
import { JmapClient, ref } from './jmap'
import { normaliseRole, quirks } from '../jmap/quirks'
import type {
    Email,
    EmailAddress,
    EmailFilter,
    Identity,
    Mailbox,
    Quota,
    SetResponse,
    VacationResponse,
} from '../jmap/types'
import { CAP_QUOTA } from '../jmap/types'

export const LIST_PROPERTIES = [
    'id',
    'threadId',
    'mailboxIds',
    'keywords',
    'from',
    'to',
    'subject',
    'receivedAt',
    'preview',
    'hasAttachment',
    'size',
]

export const READ_PROPERTIES = [
    ...LIST_PROPERTIES,
    'blobId',
    'messageId',
    'inReplyTo',
    'references',
    'sender',
    'cc',
    'bcc',
    'replyTo',
    'sentAt',
    'attachments',
    'header:Authentication-Results:asText',
]

const MAILBOX_PROPERTIES = [
    'id',
    'name',
    'parentId',
    'role',
    'sortOrder',
    'totalEmails',
    'unreadEmails',
    'totalThreads',
    'unreadThreads',
    'myRights',
]

export async function getMailboxes(
    jmap: JmapClient,
): Promise<{ list: Mailbox[]; state: string }> {
    const r = await jmap.call<{ list: Mailbox[]; state: string }>('Mailbox/get', {
        ids: null,
        properties: MAILBOX_PROPERTIES,
    })
    return {
        state: r.state,
        list: r.list.map((m) => ({ ...m, role: normaliseRole(m.role), sortOrder: m.sortOrder ?? 0 })),
    }
}

function setFailure(r: SetResponse, op: 'notCreated' | 'notUpdated' | 'notDestroyed'): string | null {
    const errs = r[op]
    if (!errs) return null
    const first = Object.values(errs)[0]
    return first ? first.type + (first.description ? `: ${first.description}` : '') : null
}

export class SetFailed extends Error {
    type: string
    constructor(message: string) {
        super(message)
        this.type = message.split(':')[0]
    }
}

function assertSet(r: SetResponse): SetResponse {
    const f =
        setFailure(r, 'notCreated') ?? setFailure(r, 'notUpdated') ?? setFailure(r, 'notDestroyed')
    if (f) throw new SetFailed(f)
    return r
}

export async function createMailbox(jmap: JmapClient, name: string, parentId: string | null) {
    const r = await jmap.call<SetResponse>('Mailbox/set', {
        create: { new: { name, parentId, isSubscribed: true } },
    })
    return assertSet(r)
}

export async function renameMailbox(jmap: JmapClient, id: string, name: string) {
    return assertSet(await jmap.call<SetResponse>('Mailbox/set', { update: { [id]: { name } } }))
}

export async function destroyMailbox(jmap: JmapClient, id: string) {
    return assertSet(
        await jmap.call<SetResponse>('Mailbox/set', {
            destroy: [id],
            onDestroyRemoveEmails: false,
        }),
    )
}

export type ThreadSummary = {
    threadId: string
    /** The newest email in the thread that matched the query (the row's face). */
    email: Email
    emailIds: string[]
    /** mailboxIds + keywords of every email in the thread. */
    members: Pick<Email, 'id' | 'mailboxIds' | 'keywords'>[]
    unread: boolean
    flagged: boolean
    draft: boolean
}

export type ListPage = {
    threads: ThreadSummary[]
    total: number | null
    position: number
    queryState: string
}

export async function queryThreads(
    jmap: JmapClient,
    filter: EmailFilter,
    position: number,
    limit = quirks.pageSize,
): Promise<ListPage> {
    const r = await jmap.request([
        [
            'Email/query',
            {
                filter,
                sort: [{ property: 'receivedAt', isAscending: false }],
                collapseThreads: true,
                position,
                limit,
                calculateTotal: true,
            },
            'q',
        ],
        [
            'Email/get',
            { '#ids': ref('q', 'Email/query', '/ids'), properties: LIST_PROPERTIES },
            'e',
        ],
        [
            'Thread/get',
            { '#ids': ref('e', 'Email/get', '/list/*/threadId') },
            't',
        ],
        [
            'Email/get',
            {
                '#ids': ref('t', 'Thread/get', '/list/*/emailIds'),
                properties: ['id', 'mailboxIds', 'keywords'],
            },
            'm',
        ],
    ])
    const ids: string[] = r.q.ids
    const emails = new Map<string, Email>((r.e.list as Email[]).map((e) => [e.id, e]))
    const threads = new Map<string, string[]>(
        (r.t.list as { id: string; emailIds: string[] }[]).map((t) => [t.id, t.emailIds]),
    )
    const members = new Map<string, Pick<Email, 'id' | 'mailboxIds' | 'keywords'>>(
        (r.m.list as Email[]).map((e) => [e.id, e]),
    )
    const out: ThreadSummary[] = []
    for (const id of ids) {
        const email = emails.get(id)
        if (!email) continue
        const emailIds = threads.get(email.threadId) ?? [email.id]
        const mem = emailIds.map((x) => members.get(x)).filter(Boolean) as ThreadSummary['members']
        const all = mem.length ? mem : [email]
        out.push({
            threadId: email.threadId,
            email,
            emailIds,
            members: all,
            unread: all.some((m) => !m.keywords?.$seen && !m.keywords?.$draft),
            flagged: all.some((m) => m.keywords?.$flagged),
            draft: !!email.keywords?.$draft,
        })
    }
    return {
        threads: out,
        total: typeof r.q.total === 'number' ? r.q.total : null,
        position: r.q.position ?? position,
        queryState: r.q.queryState,
    }
}

export async function getThread(jmap: JmapClient, threadId: string): Promise<Email[]> {
    const r = await jmap.request([
        ['Thread/get', { ids: [threadId] }, 't'],
        [
            'Email/get',
            { '#ids': ref('t', 'Thread/get', '/list/*/emailIds'), properties: READ_PROPERTIES },
            'e',
        ],
    ])
    const order: string[] = r.t.list[0]?.emailIds ?? []
    const byId = new Map<string, Email>((r.e.list as Email[]).map((e) => [e.id, e]))
    return order.map((id) => byId.get(id)).filter(Boolean) as Email[]
}

/** Text body of one email, for quoting in replies and forwards. */
export async function getQuoteBody(jmap: JmapClient, emailId: string): Promise<Email | null> {
    const r = await jmap.call<{ list: Email[] }>('Email/get', {
        ids: [emailId],
        properties: [...READ_PROPERTIES, 'textBody', 'htmlBody', 'bodyValues'],
        fetchTextBodyValues: true,
        fetchHTMLBodyValues: true,
        maxBodyValueBytes: quirks.quoteBodyBytes,
    })
    return r.list[0] ?? null
}

/** Apply one patch object to many emails. */
export async function patchEmails(
    jmap: JmapClient,
    patches: Record<string, Record<string, unknown>>,
): Promise<void> {
    if (!Object.keys(patches).length) return
    assertSet(await jmap.call<SetResponse>('Email/set', { update: patches }))
}

export async function destroyEmails(jmap: JmapClient, ids: string[]): Promise<void> {
    if (!ids.length) return
    assertSet(await jmap.call<SetResponse>('Email/set', { destroy: ids }))
}

export async function getEmailState(jmap: JmapClient): Promise<string> {
    const r = await jmap.call<{ state: string }>('Email/get', { ids: [], properties: ['id'] })
    return r.state
}

export async function getIdentities(jmap: JmapClient): Promise<Identity[]> {
    const r = await jmap.call<{ list?: Identity[] }>('Identity/get', { ids: null })
    return r.list ?? []
}

export async function updateIdentity(jmap: JmapClient, id: string, patch: Partial<Identity>) {
    return assertSet(await jmap.call<SetResponse>('Identity/set', { update: { [id]: patch } }))
}

export async function getVacation(jmap: JmapClient): Promise<VacationResponse | null> {
    const r = await jmap.call<{ list: VacationResponse[] }>('VacationResponse/get', {
        ids: ['singleton'],
    })
    return r.list[0] ?? null
}

export async function setVacation(jmap: JmapClient, patch: Partial<VacationResponse>) {
    return assertSet(
        await jmap.call<SetResponse>('VacationResponse/set', { update: { singleton: patch } }),
    )
}

export async function getQuota(jmap: JmapClient): Promise<Quota | null> {
    if (!jmap.has(CAP_QUOTA)) return null
    const r = await jmap.call<{ list: Quota[] }>('Quota/get', { ids: null })
    const octets = r.list.filter((q) => q.resourceType === 'octets' && q.hardLimit > 0)
    return octets.find((q) => q.types?.includes('Mail')) ?? octets[0] ?? null
}

/** Recent correspondents for compose autocomplete. */
export async function getRecentAddresses(
    jmap: JmapClient,
    mailboxIds: string[],
): Promise<EmailAddress[]> {
    if (!mailboxIds.length) return []
    const calls = mailboxIds.flatMap((mb, i): [string, Record<string, unknown>, string][] => [
        [
            'Email/query',
            {
                filter: { inMailbox: mb },
                sort: [{ property: 'receivedAt', isAscending: false }],
                limit: 100,
            },
            `q${i}`,
        ],
        [
            'Email/get',
            {
                '#ids': ref(`q${i}`, 'Email/query', '/ids'),
                properties: ['from', 'to', 'cc'],
            },
            `g${i}`,
        ],
    ])
    const r = await jmap.request(calls)
    const out: EmailAddress[] = []
    mailboxIds.forEach((_, i) => {
        for (const e of (r[`g${i}`]?.list ?? []) as Email[]) {
            for (const a of [...(e.from ?? []), ...(e.to ?? []), ...(e.cc ?? [])]) out.push(a)
        }
    })
    return out
}

export type MessageHtml = { html: string; hasRemote: boolean; remoteBlocked: number; plain: boolean }

export function getMessageHtml(emailId: string, images: boolean): Promise<MessageHtml> {
    return api<MessageHtml>(
        `/api/message-html/${encodeURIComponent(emailId)}?images=${images ? 1 : 0}`,
    )
}
