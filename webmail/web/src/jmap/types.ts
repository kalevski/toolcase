// The subset of RFC 8620 / RFC 8621 objects this client reads and writes.

export const CAP_CORE = 'urn:ietf:params:jmap:core'
export const CAP_MAIL = 'urn:ietf:params:jmap:mail'
export const CAP_SUBMISSION = 'urn:ietf:params:jmap:submission'
export const CAP_VACATION = 'urn:ietf:params:jmap:vacationresponse'
export const CAP_QUOTA = 'urn:ietf:params:jmap:quota'

export type JmapSession = {
    capabilities: Record<string, Record<string, unknown>>
    accounts: Record<
        string,
        {
            name: string
            isPersonal: boolean
            isReadOnly: boolean
            accountCapabilities: Record<string, Record<string, unknown>>
        }
    >
    primaryAccounts: Record<string, string>
    username: string
    apiUrl: string
    downloadUrl: string
    uploadUrl: string
    eventSourceUrl: string
    state: string
}

export type Invocation = [string, Record<string, unknown>, string]

export type ResultRef = { resultOf: string; name: string; path: string }

export type MailboxRole =
    | 'inbox'
    | 'drafts'
    | 'sent'
    | 'junk'
    | 'trash'
    | 'archive'
    | 'important'
    | 'all'
    | 'flagged'
    | null

export type MailboxRights = {
    mayReadItems?: boolean
    mayAddItems?: boolean
    mayRemoveItems?: boolean
    mayCreateChild?: boolean
    mayRename?: boolean
    mayDelete?: boolean
}

export type Mailbox = {
    id: string
    name: string
    parentId: string | null
    role: MailboxRole
    sortOrder: number
    totalEmails: number
    unreadEmails: number
    totalThreads: number
    unreadThreads: number
    myRights?: MailboxRights
}

export type EmailAddress = { name: string | null; email: string }

export type BodyPart = {
    partId: string | null
    blobId: string | null
    size: number
    name: string | null
    type: string
    charset?: string | null
    disposition: string | null
    cid: string | null
}

export type Email = {
    id: string
    blobId: string
    threadId: string
    mailboxIds: Record<string, boolean>
    keywords: Record<string, boolean>
    size: number
    receivedAt: string
    messageId?: string[] | null
    inReplyTo?: string[] | null
    references?: string[] | null
    sender?: EmailAddress[] | null
    from: EmailAddress[] | null
    to: EmailAddress[] | null
    cc: EmailAddress[] | null
    bcc: EmailAddress[] | null
    replyTo: EmailAddress[] | null
    subject: string | null
    sentAt: string | null
    hasAttachment: boolean
    preview: string
    attachments?: BodyPart[]
    textBody?: BodyPart[]
    htmlBody?: BodyPart[]
    bodyValues?: Record<string, { value: string; isTruncated?: boolean }>
    [header: `header:${string}`]: unknown
}

export type Thread = { id: string; emailIds: string[] }

export type Identity = {
    id: string
    name: string
    email: string
    replyTo: EmailAddress[] | null
    bcc: EmailAddress[] | null
    textSignature: string
    htmlSignature: string
    mayDelete: boolean
}

export type VacationResponse = {
    id: string
    isEnabled: boolean
    fromDate: string | null
    toDate: string | null
    subject: string | null
    textBody: string | null
    htmlBody: string | null
}

export type Quota = {
    id: string
    resourceType: string
    used: number
    hardLimit: number
    scope: string
    name: string
    types: string[]
}

export type SetError = { type: string; description?: string; properties?: string[] }

export type SetResponse<T = Record<string, unknown>> = {
    accountId: string
    oldState?: string
    newState: string
    created?: Record<string, T & { id: string }> | null
    updated?: Record<string, T | null> | null
    destroyed?: string[] | null
    notCreated?: Record<string, SetError> | null
    notUpdated?: Record<string, SetError> | null
    notDestroyed?: Record<string, SetError> | null
}

export type EmailFilter = {
    inMailbox?: string
    inMailboxOtherThan?: string[]
    before?: string
    after?: string
    hasKeyword?: string
    notKeyword?: string
    text?: string
    from?: string
    to?: string
    subject?: string
}

export type StateChange = {
    '@type': 'StateChange'
    changed: Record<string, Record<string, string>>
}
