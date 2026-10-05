import type { DraftAttachment } from '../../api/compose'
import type { Email, EmailAddress } from '../../jmap/types'

export type ComposeState = {
    identityId: string
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    showCc: boolean
    subject: string
    rich: boolean
    /** Editor HTML (rich mode) — always produced by our own serialiser or escaping. */
    html: string
    /** Body text (plain mode). */
    text: string
    attachments: DraftAttachment[]
    inReplyTo: string[] | null
    references: string[] | null
    draftId: string | null
}

export type ComposeInit =
    | { mode: 'new'; to?: EmailAddress[] }
    | { mode: 'reply' | 'replyAll' | 'forward'; source: Email }
    | { mode: 'draft'; source: Email }
    | { mode: 'restore'; state: ComposeState }
