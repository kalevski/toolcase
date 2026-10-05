import { useEffect, useState } from 'react'
import { getMessageHtml, type MessageHtml } from '../api/mail'
import type { BodyPart, Email } from '../jmap/types'
import { t } from '../i18n'
import { useMail } from '../state/mail'
import { displayName, formatAddressList, formatBytes, formatLongDate } from '../util/format'
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
    if (!src) return <tc-icon name={part.type.startsWith('image/') ? 'image' : 'file-text'} size="28" decorative></tc-icon>
    return <img className="wm-attachment__thumb" src={src} alt="" />
}

export function MessageCard({ email, expanded, onToggle, onReply, onJunk, inJunk }: Props) {
    const { jmap, prefs, updatePrefs } = useMail()
    const [details, setDetails] = useState(false)
    const [body, setBody] = useState<MessageHtml | null>(null)
    const [bodyError, setBodyError] = useState(false)
    const [forceImages, setForceImages] = useState(false)
    const [source, setSource] = useState<string | null>(null)
    const sender = email.from?.[0]
    const senderAddr = sender?.email.toLowerCase() ?? ''
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

    if (!expanded) {
        return (
            <article className="wm-msg is-collapsed">
                <button type="button" className="wm-msg__collapsed" onClick={onToggle} aria-expanded={false}>
                    <span className="wm-msg__from">{displayName(sender) || t('list.unknownSender')}</span>
                    <span className="wm-msg__preview">{email.preview}</span>
                    <time className="wm-msg__date">{formatLongDate(email.receivedAt)}</time>
                </button>
            </article>
        )
    }

    const showBanner = body?.hasRemote && !images && prefs.imagePolicy !== 'never'

    return (
        <article className="wm-msg" aria-label={displayName(sender)}>
            <header className="wm-msg__head">
                <button type="button" className="wm-msg__toggle" onClick={onToggle} aria-expanded={true}>
                    <span className="wm-msg__from">
                        <strong>{sender?.name || sender?.email || t('list.unknownSender')}</strong>
                        {sender?.name ? <span className="wm-muted"> &lt;{sender.email}&gt;</span> : null}
                    </span>
                    <time className="wm-msg__date" dateTime={email.receivedAt}>
                        {formatLongDate(email.sentAt ?? email.receivedAt)}
                    </time>
                </button>
                <div className="wm-msg__meta">
                    <span className="wm-muted">
                        {t('read.to')}: {formatAddressList(email.to) || '—'}
                    </span>
                    <button type="button" className="wm-linkbtn" onClick={() => setDetails((d) => !d)} aria-expanded={details}>
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
                        <dd>{formatAddressList(email.to) || '—'}</dd>
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
                <div className="wm-banner" role="region" aria-label={t('read.remoteBlocked')}>
                    <span>
                        {body?.remoteBlocked
                            ? t('read.remoteBlockedCount', { count: body.remoteBlocked })
                            : t('read.remoteBlocked')}
                    </span>
                    <span className="wm-banner__actions">
                        <tc-button size="sm" variant="secondary" outline onClick={() => setForceImages(true)}>
                            {t('read.loadImages')}
                        </tc-button>
                        {prefs.imagePolicy === 'ask' && senderAddr ? (
                            <tc-button size="sm" variant="secondary" outline onClick={trustSender}>
                                {t('read.alwaysSender')}
                            </tc-button>
                        ) : null}
                    </span>
                </div>
            ) : null}

            <div className="wm-msg__body">
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
                                        <span className="wm-muted">{formatBytes(a.size)}</span>
                                    </a>
                                </li>
                            ) : null,
                        )}
                    </ul>
                </section>
            ) : null}

            <footer className="wm-msg__actions" aria-label={t('list.actions')}>
                <tc-icon-button icon="Reply" label={t('action.reply')} show-label="always" ontc-click={() => onReply('reply', email)}></tc-icon-button>
                <tc-icon-button icon="ReplyAll" label={t('action.replyAll')} show-label="always" ontc-click={() => onReply('replyAll', email)}></tc-icon-button>
                <tc-icon-button icon="Forward" label={t('action.forward')} show-label="always" ontc-click={() => onReply('forward', email)}></tc-icon-button>
                <tc-icon-button icon="Printer" label={t('action.print')} ontc-click={() => window.print()}></tc-icon-button>
                <tc-icon-button icon="Code" label={t('action.source')} ontc-click={() => void viewSource()}></tc-icon-button>
                <tc-icon-button
                    icon="ShieldAlert"
                    label={inJunk ? t('action.notJunk') : t('action.junk')}
                    ontc-click={() => onJunk(email)}
                ></tc-icon-button>
            </footer>

            <Dialog open={source !== null} title={t('read.sourceTitle')} onClose={() => setSource(null)} size="xl">
                {source === '' ? <tc-spinner></tc-spinner> : <pre className="wm-source">{source}</pre>}
            </Dialog>
        </article>
    )
}
