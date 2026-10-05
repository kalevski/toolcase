import type { JmapClient } from '../../api/jmap'
import { getQuoteBody } from '../../api/mail'
import type { Email, EmailAddress, Identity } from '../../jmap/types'
import { t } from '../../i18n'
import { displayName, formatAddressList, formatLongDate } from '../../util/format'
import { quoteText, textToHtml } from '../../util/richtext'
import type { ComposeInit, ComposeState } from './types'

export function pickIdentity(identities: Identity[], address: string, source?: Email): Identity | undefined {
    const mine = (e: string) => identities.find((i) => i.email.toLowerCase() === e.toLowerCase())
    if (source) {
        for (const a of [...(source.to ?? []), ...(source.cc ?? [])]) {
            const hit = mine(a.email)
            if (hit) return hit
        }
    }
    return mine(address) ?? identities[0]
}

function signatureText(identity?: Identity): string {
    const sig = identity?.textSignature?.trim()
    return sig ? `\n\n-- \n${sig}` : ''
}

function bodyText(e: Email | null): string {
    if (!e) return ''
    const parts = e.textBody ?? []
    return parts
        .map((p) => (p.partId ? e.bodyValues?.[p.partId]?.value ?? '' : ''))
        .join('\n')
        .replace(/\r\n/g, '\n')
}

function prefixed(subject: string | null, prefix: 'Re' | 'Fwd'): string {
    const s = (subject ?? '').trim()
    const re = prefix === 'Re' ? /^re:/i : /^(fwd?|fw):/i
    return re.test(s) ? s : `${prefix}: ${s}`
}

function without(list: EmailAddress[], drop: string[]): EmailAddress[] {
    const d = new Set(drop.map((x) => x.toLowerCase()))
    const seen = new Set<string>()
    return list.filter((a) => {
        const k = a.email.toLowerCase()
        if (d.has(k) || seen.has(k)) return false
        seen.add(k)
        return true
    })
}

function empty(identity?: Identity): ComposeState {
    return {
        identityId: identity?.id ?? '',
        to: [],
        cc: [],
        bcc: [],
        showCc: false,
        subject: '',
        rich: false,
        html: '',
        text: '',
        attachments: [],
        inReplyTo: null,
        references: null,
        draftId: null,
    }
}

export async function buildComposeState(
    init: ComposeInit,
    jmap: JmapClient,
    identities: Identity[],
    address: string,
): Promise<ComposeState> {
    if (init.mode === 'restore') return init.state
    if (init.mode === 'new') {
        const id = pickIdentity(identities, address)
        const text = signatureText(id)
        return { ...empty(id), to: init.to ?? [], text, html: textToHtml(text) }
    }
    const full = await getQuoteBody(jmap, init.source.id)
    const src = full ?? init.source
    if (init.mode === 'draft') {
        const id = identities.find((i) => i.email.toLowerCase() === src.from?.[0]?.email.toLowerCase()) ?? pickIdentity(identities, address)
        const text = bodyText(full)
        return {
            ...empty(id),
            to: src.to ?? [],
            cc: src.cc ?? [],
            bcc: src.bcc ?? [],
            showCc: !!(src.cc?.length || src.bcc?.length),
            subject: src.subject ?? '',
            text,
            html: textToHtml(text),
            attachments: (src.attachments ?? [])
                .filter((a) => a.blobId)
                .map((a) => ({ blobId: a.blobId!, name: a.name ?? 'attachment', type: a.type, size: a.size })),
            inReplyTo: src.inReplyTo ?? null,
            references: src.references ?? null,
            draftId: src.id,
        }
    }
    const id = pickIdentity(identities, address, src)
    const own = [address, ...identities.map((i) => i.email)]
    const original = bodyText(full)
    const sender = displayName(src.from?.[0]) || src.from?.[0]?.email || ''
    const sig = signatureText(id)
    if (init.mode === 'forward') {
        const header = [
            t('compose.forwarded'),
            `${t('read.from')}: ${formatAddressList(src.from)}`,
            `${t('read.date')}: ${formatLongDate(src.sentAt ?? src.receivedAt)}`,
            `${t('compose.subject')}: ${src.subject ?? ''}`,
            `${t('read.to')}: ${formatAddressList(src.to)}`,
        ].join('\n')
        const text = `${sig}\n\n${header}\n\n${original}`
        return {
            ...empty(id),
            subject: prefixed(src.subject, 'Fwd'),
            text,
            html: textToHtml(text),
            attachments: (src.attachments ?? [])
                .filter((a) => a.blobId)
                .map((a) => ({ blobId: a.blobId!, name: a.name ?? 'attachment', type: a.type, size: a.size })),
            references: [...(src.references ?? []), ...(src.messageId ?? [])],
        }
    }
    const replyTo = src.replyTo?.length ? src.replyTo : src.from ?? []
    let to = without(replyTo, own)
    let cc: EmailAddress[] = []
    if (init.mode === 'replyAll') {
        to = without([...replyTo, ...(src.to ?? [])], own)
        cc = without(src.cc ?? [], [...own, ...to.map((a) => a.email)])
    }
    // Replying to your own sent message: answer its recipients instead.
    if (!to.length) to = without(src.to ?? [], own)
    const quoteHead = t('compose.onDate', { date: formatLongDate(src.sentAt ?? src.receivedAt), sender })
    const text = `\n${sig}\n\n${quoteHead}\n${quoteText(original)}`
    return {
        ...empty(id),
        to,
        cc,
        showCc: cc.length > 0,
        subject: prefixed(src.subject, 'Re'),
        text,
        html: textToHtml(`\n${sig}\n\n${quoteHead}`) + `<blockquote>${textToHtml(original)}</blockquote>`,
        inReplyTo: src.messageId ?? null,
        references: [...(src.references ?? []), ...(src.messageId ?? [])],
    }
}
