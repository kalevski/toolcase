import { useEffect, useRef, useState } from 'react'
import { getMessageHtml, type MessageHtml } from '../api/mail'
import type { BodyPart, Email } from '../jmap/types'
import { t } from '../i18n'
import { useMail } from '../state/mail'
import { displayName, formatAddress, formatAddressList, formatBytes, formatLongDate } from '../util/format'
import { failedAuthChecks } from '../util/safe'
import { Dialog } from './Dialog'

export type ReplyMode = 'reply' | 'replyAll' | 'forward'

type Props = {
    email: Email
    expanded: boolean
    onToggle: () => void
    onReply: (mode: ReplyMode, email: Email) => void
    onJunk: (email: Email) => void
    inJunk: boolean
}

const initialOf = (s: string) => (s.trim()[0] ?? '?').toUpperCase()

/**
 * How tall the body frame needs to be. A sandboxed frame without same-origin cannot be measured, so short
 * text-only messages are estimated from the sanitised document (parsed inert: DOMParser runs no script and loads
 * no image) and get a frame that fits; anything with images or tables, or longer than the cap, keeps the fixed
 * height and scrolls inside. Returns null for "use the fixed height".
 */
function estimateFrameHeight(html: string, width: number): number | null {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (doc.querySelector('img, table, video, svg, iframe, object, embed')) return null
    const perLine = Math.max(28, Math.floor((width - 24) / 8))
    let lines = 0
    for (const raw of (doc.body.innerText ?? doc.body.textContent ?? '').split('\n')) {
        lines += Math.max(1, Math.ceil(raw.length / perLine))
    }
    lines += doc.querySelectorAll('p, blockquote, h1, h2, h3, h4, li, hr, pre').length * 0.6
    let extra = 0
    doc.querySelectorAll<HTMLElement>('.wm-img-blocked').forEach((el) => {
        extra += parseInt(el.style.height || '0', 10) || 0
    })
    const height = Math.ceil((lines * 22 + extra + 28) * 1.15)
    const cap = Math.round(window.innerHeight * 0.68)
    return height < cap ? Math.max(96, height) : null
}

function AttachmentThumb({ part }: { part: BodyPart }) {
    const { jmap } = useMail()
    const [src, setSrc] = useState('')
    useEffect(() => {
        // Images only, with a checked raster media type, as blob: URLs.
        if (!part.blobId || !/^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(part.type) || part.size > 5_000_000) return
        let url = ''
        let cancelled = false
        fetch(jmap.downloadUrl(part.blobId, part.name ?? 'image', part.type), { credentials: 'same-origin' })
            .then(async (res) => {
                if (!res.ok) return
                const type = (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
                if (!/^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(type)) return
                const blob = await res.blob()
                if (cancelled) return
                url = URL.createObjectURL(new Blob([blob], { type }))
                setSrc(url)
            })
            .catch(() => {})
        return () => {
            cancelled = true
            if (url) URL.revokeObjectURL(url)
        }
    }, [jmap, part.blobId, part.name, part.size, part.type])
    if (!src) return <tc-icon name={part.type.startsWith('image/') ? 'image' : 'file-text'} size="20" decorative></tc-icon>
    return <img className="wm-attachment__thumb" src={src} alt="" />
}

/**
 * One message of a conversation, as the dashboard draws a thread: an avatar on the timeline and a card with a
 * tinted head (who, when, to whom), the sanitised body in its frame, the attachments and one row of actions.
 */
export function MessageCard({ email, expanded, onToggle, onReply, onJunk, inJunk }: Props) {
    const { jmap, prefs, updatePrefs, session } = useMail()
    const bodyRef = useRef<HTMLDivElement>(null)
    const [frameHeight, setFrameHeight] = useState<number | null>(null)
    const [details, setDetails] = useState(false)
    const [body, setBody] = useState<MessageHtml | null>(null)
    const [bodyError, setBodyError] = useState(false)
    const [forceImages, setForceImages] = useState(false)
    const [source, setSource] = useState<string | null>(null)
    const sender = email.from?.[0]
    const senderAddr = sender?.email.toLowerCase() ?? ''
    const senderName = displayName(sender) || t('list.unknownSender')
    const trusted = !!senderAddr && prefs.trustedSenders.some((s) => s.toLowerCase() === senderAddr)
    const images = forceImages || prefs.imagePolicy === 'always' || trusted
    const authFails = failedAuthChecks(email['header:Authentication-Results:asText'])
    const attachments = (email.attachments ?? []).filter((a) => a.disposition !== 'inline' || !a.cid)

    useEffect(() => {
        if (!expanded) return
        let cancelled = false
        setBodyError(false)
        getMessageHtml(email.id, images)
            .then((b) => !cancelled && setBody(b))
            .catch(() => !cancelled && setBodyError(true))
        return () => {
            cancelled = true
        }
    }, [email.id, expanded, images])

    useEffect(() => {
        if (!body) return
        setFrameHeight(estimateFrameHeight(body.html, bodyRef.current?.clientWidth ?? 600))
    }, [body])

    // The reader is "me": an empty To (Bcc, undisclosed recipients) or their own address reads as "me".
    const own = session.address.toLowerCase()
    const toText =
        (email.to ?? []).map((a) => (a.email.toLowerCase() === own ? t('read.toMe') : formatAddress(a))).join(', ') ||
        t('read.toMe')

    const viewSource = async () => {
        setSource('')
        try {
            const res = await fetch(jmap.downloadUrl(email.blobId, 'message.eml', 'text/plain'), {
                credentials: 'same-origin',
            })
            if (!res.ok) throw new Error(String(res.status))
            const text = await res.text()
            setSource(text.length > 2_000_000 ? text.slice(0, 2_000_000) + '\n…' : text)
        } catch {
            setSource(t('common.error'))
        }
    }

    const trustSender = () => {
        if (!senderAddr || trusted) return
        void updatePrefs({ trustedSenders: [...prefs.trustedSenders, senderAddr] })
    }

    const avatar = (
        <span className="wm-msg__avatar" aria-hidden="true">
            {initialOf(senderName)}
        </span>
    )

    if (!expanded) {
        return (
            <article className="wm-msg is-collapsed">
                {avatar}
                <div className="wm-msg__card">
                    <button type="button" className="wm-msg__collapsed" onClick={onToggle} aria-expanded={false}>
                        <span className="wm-msg__from">{senderName}</span>
                        <span className="wm-msg__preview">{email.preview}</span>
                        <time className="wm-msg__date">{formatLongDate(email.receivedAt)}</time>
                    </button>
                </div>
            </article>
        )
    }

    const showBanner = body?.hasRemote && !images && prefs.imagePolicy !== 'never'

    return (
        <article className="wm-msg" aria-label={senderName}>
            {avatar}
            <div className="wm-msg__card">
                <header className="wm-msg__head">
                    <button type="button" className="wm-msg__toggle" onClick={onToggle} aria-expanded={true}>
                        <span className="wm-msg__from">
                            {sender?.name || sender?.email || t('list.unknownSender')}
                            {sender?.name ? <span className="wm-msg__addr"> &lt;{sender.email}&gt;</span> : null}
                        </span>
                        <time className="wm-msg__date" dateTime={email.receivedAt}>
                            {formatLongDate(email.sentAt ?? email.receivedAt)}
                        </time>
                    </button>
                    <div className="wm-msg__meta">
                        <span>
                            {t('read.to')}: {toText}
                        </span>
                        <button
                            type="button"
                            className="wm-linkbtn"
                            onClick={() => setDetails((d) => !d)}
                            aria-expanded={details}
                        >
                            {details ? t('read.hideDetails') : t('read.details')}
                        </button>
                    </div>
                    {details ? (
                        <dl className="wm-msg__details">
                            <dt>{t('read.from')}</dt>
                            <dd>{formatAddressList(email.from)}</dd>
                            {email.replyTo?.length ? (
                                <>
                                    <dt>{t('read.replyTo')}</dt>
                                    <dd>{formatAddressList(email.replyTo)}</dd>
                                </>
                            ) : null}
                            <dt>{t('read.to')}</dt>
                            <dd>{toText}</dd>
                            {email.cc?.length ? (
                                <>
                                    <dt>{t('read.cc')}</dt>
                                    <dd>{formatAddressList(email.cc)}</dd>
                                </>
                            ) : null}
                            {email.bcc?.length ? (
                                <>
                                    <dt>{t('read.bcc')}</dt>
                                    <dd>{formatAddressList(email.bcc)}</dd>
                                </>
                            ) : null}
                            <dt>{t('read.date')}</dt>
                            <dd>{formatLongDate(email.sentAt ?? email.receivedAt)}</dd>
                        </dl>
                    ) : null}
                    {authFails.length ? (
                        <tc-notice
                            tone="danger"
                            icon="shield-x"
                            label={t('read.authFail')}
                            text={t('read.authFailDetail', { checks: authFails.join(', ') })}
                        ></tc-notice>
                    ) : null}
                </header>

                {showBanner ? (
                    <div
                        className="wm-banner"
                        role="region"
                        aria-label={
                            body?.remoteBlocked
                                ? t('read.remoteBlockedCount', { count: body.remoteBlocked })
                                : t('read.remoteBlocked')
                        }
                    >
                        <tc-icon name="ImageOff" size="14" decorative></tc-icon>
                        <span className="wm-banner__text">{t('read.imagesOff')}</span>
                        <button type="button" className="wm-linkbtn" onClick={() => setForceImages(true)}>
                            {t('read.loadImages')}
                        </button>
                        {prefs.imagePolicy === 'ask' && senderAddr ? (
                            <button type="button" className="wm-linkbtn" onClick={trustSender}>
                                {t('read.alwaysSender')}
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <div className="wm-msg__body" ref={bodyRef}>
                    {bodyError ? (
                        <p className="wm-error">{t('read.bodyError')}</p>
                    ) : body ? (
                        // Untrusted mail: server-sanitised document in a sandbox with
                        // no scripts and no same-origin; links open in a new context.
                        <iframe
                            className="wm-msg__frame"
                            title={t('read.bodyFrame')}
                            sandbox="allow-popups allow-popups-to-escape-sandbox"
                            referrerPolicy="no-referrer"
                            srcDoc={body.html}
                            style={frameHeight ? { height: frameHeight, minHeight: 0 } : undefined}
                        />
                    ) : (
                        <tc-spinner label={t('read.loadingBody')}></tc-spinner>
                    )}
                </div>

                {attachments.length ? (
                    <section className="wm-attachments" aria-label={t('read.attachments', { count: attachments.length })}>
                        <h3 className="wm-attachments__title">{t('read.attachments', { count: attachments.length })}</h3>
                        <ul className="wm-attachments__list">
                            {attachments.map((a, i) =>
                                a.blobId ? (
                                    <li key={a.blobId + i}>
                                        <a
                                            className="wm-attachment"
                                            href={jmap.downloadUrl(a.blobId, a.name ?? 'attachment', a.type)}
                                            download={a.name ?? 'attachment'}
                                            rel="noopener noreferrer"
                                            aria-label={t('read.download', { name: a.name ?? 'attachment' })}
                                        >
                                            <AttachmentThumb part={a} />
                                            <span className="wm-attachment__name">{a.name ?? 'attachment'}</span>
                                            <span className="wm-attachment__size">{formatBytes(a.size)}</span>
                                        </a>
                                    </li>
                                ) : null,
                            )}
                        </ul>
                    </section>
                ) : null}

                <footer className="wm-msg__actions" aria-label={t('list.actions')}>
                    <tc-icon-button icon="Reply" size="small" label={t('action.reply')} show-label="always" ontc-click={() => onReply('reply', email)}></tc-icon-button>
                    <tc-icon-button icon="ReplyAll" size="small" label={t('action.replyAll')} show-label="always" ontc-click={() => onReply('replyAll', email)}></tc-icon-button>
                    <tc-icon-button icon="Forward" size="small" label={t('action.forward')} show-label="always" ontc-click={() => onReply('forward', email)}></tc-icon-button>
                    <span className="wm-toolbar__spacer" />
                    <tc-icon-button icon="Printer" size="small" label={t('action.print')} ontc-click={() => window.print()}></tc-icon-button>
                    <tc-icon-button icon="Code" size="small" label={t('action.source')} ontc-click={() => void viewSource()}></tc-icon-button>
                    <tc-icon-button
                        icon="ShieldAlert"
                        size="small"
                        label={inJunk ? t('action.notJunk') : t('action.junk')}
                        ontc-click={() => onJunk(email)}
                    ></tc-icon-button>
                </footer>
            </div>

            <Dialog open={source !== null} title={t('read.sourceTitle')} onClose={() => setSource(null)} size="xl">
                {source === '' ? <tc-spinner></tc-spinner> : <pre className="wm-source">{source}</pre>}
            </Dialog>
        </article>
    )
}
