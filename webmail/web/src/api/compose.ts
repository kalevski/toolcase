// Draft save and send (RFC 8621 §4.6 Email/set, §7.5 EmailSubmission/set).
//
// JMAP Email objects are immutable apart from keywords and mailboxIds, so
// "updating" a draft means creating a new one and destroying the old one in the
// same Email/set call.

import { JmapClient } from './jmap'
import { SetFailed } from './mail'
import type { EmailAddress, SetResponse } from '../jmap/types'

export type DraftAttachment = {
    blobId: string
    name: string
    type: string
    size: number
}

export type Draft = {
    identityId: string
    from: EmailAddress
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    text: string
    /** Restricted HTML from the rich editor, or null for plain text only. */
    html: string | null
    attachments: DraftAttachment[]
    inReplyTo: string[] | null
    references: string[] | null
}

function emailObject(d: Draft, draftsId: string): Record<string, unknown> {
    const obj: Record<string, unknown> = {
        mailboxIds: { [draftsId]: true },
        keywords: { $draft: true, $seen: true },
        from: [d.from],
        to: d.to,
        cc: d.cc,
        bcc: d.bcc,
        subject: d.subject,
        textBody: [{ partId: 'text', type: 'text/plain' }],
        bodyValues: { text: { value: d.text } } as Record<string, { value: string }>,
        attachments: d.attachments.map((a) => ({
            blobId: a.blobId,
            type: a.type,
            name: a.name,
            size: a.size,
            disposition: 'attachment',
        })),
    }
    if (d.html !== null) {
        obj.htmlBody = [{ partId: 'html', type: 'text/html' }]
        ;(obj.bodyValues as Record<string, { value: string }>).html = {
            value: `<!DOCTYPE html><html><body>${d.html}</body></html>`,
        }
    }
    if (d.inReplyTo?.length) obj.inReplyTo = d.inReplyTo
    if (d.references?.length) obj.references = d.references
    return obj
}

/** Save (or replace) a draft. Returns the new email id. */
export async function saveDraft(
    jmap: JmapClient,
    draft: Draft,
    draftsId: string,
    previousId: string | null,
): Promise<string> {
    const r = await jmap.call<SetResponse>('Email/set', {
        create: { draft: emailObject(draft, draftsId) },
        destroy: previousId ? [previousId] : undefined,
    })
    if (r.notCreated?.draft) {
        const e = r.notCreated.draft
        throw new SetFailed(e.type + (e.description ? `: ${e.description}` : ''))
    }
    const id = r.created?.draft?.id
    if (!id) throw new SetFailed('serverFail')
    return id
}

/**
 * Send: write the final version into Drafts, submit it, and on success move it
 * to Sent and drop $draft (onSuccessUpdateEmail), all in one request.
 */
export async function sendDraft(
    jmap: JmapClient,
    draft: Draft,
    draftsId: string,
    sentId: string | null,
    previousId: string | null,
): Promise<void> {
    const update: Record<string, unknown> = {
        [`mailboxIds/${draftsId}`]: null,
        'keywords/$draft': null,
    }
    if (sentId) update[`mailboxIds/${sentId}`] = true
    const r = await jmap.request([
        [
            'Email/set',
            {
                create: { draft: emailObject(draft, draftsId) },
                destroy: previousId ? [previousId] : undefined,
            },
            'e',
        ],
        [
            'EmailSubmission/set',
            {
                create: { send: { identityId: draft.identityId, emailId: '#draft' } },
                onSuccessUpdateEmail: { '#send': update },
            },
            's',
        ],
    ])
    const e = r.e as SetResponse
    if (e.notCreated?.draft) throw new SendFailed(e.notCreated.draft.type, previousId)
    const newId = e.created?.draft?.id ?? null
    const s = r.s as SetResponse
    if (s.notCreated?.send) {
        const err = s.notCreated.send
        throw new SendFailed(err.type + (err.description ? `: ${err.description}` : ''), newId)
    }
}

/** A failed send; `draftId` is the draft left in Drafts (to keep editing it). */
export class SendFailed extends SetFailed {
    draftId: string | null
    constructor(message: string, draftId: string | null) {
        super(message)
        this.draftId = draftId
    }
}

export async function destroyDraft(jmap: JmapClient, id: string): Promise<void> {
    await jmap.call('Email/set', { destroy: [id] })
}
