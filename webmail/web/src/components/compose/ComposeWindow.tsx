import { useCallback, useEffect, useRef, useState } from 'react'
import { destroyDraft, saveDraft, type Draft } from '../../api/compose'
import { CAP_MAIL } from '../../jmap/types'
import { t } from '../../i18n'
import { useMail } from '../../state/mail'
import { useToasts } from '../../state/toasts'
import { formatBytes, formatShortDate } from '../../util/format'
import { escapeHtml, textToHtml } from '../../util/richtext'
import { ConfirmDialog } from '../ConfirmDialog'
import { AddressField } from './AddressField'
import { buildComposeState } from './build'
import { RichEditor } from './RichEditor'
import type { ComposeInit, ComposeState } from './types'

const AUTOSAVE_MS = 10_000

type Upload = { id: number; name: string; progress: number; abort: () => void }

type Props = {
    init: ComposeInit
    onClose: () => void
    /** Hand the finished message to the shell, which runs the undo window and submits. */
    onSend: (state: ComposeState, draft: Draft) => void
}

let uploadSeq = 1

export function ComposeWindow({ init, onClose, onSend }: Props) {
    const { jmap, session, identities, roles } = useMail()
    const toasts = useToasts()
    const [state, setState] = useState<ComposeState | null>(null)
    const [uploads, setUploads] = useState<Upload[]>([])
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
    const [minimised, setMinimised] = useState(false)
    const [full, setFull] = useState(false)
    const [showBcc, setShowBcc] = useState(false)
    const [showFormat, setShowFormat] = useState(false)
    const [moreOpen, setMoreOpen] = useState(false)
    const [confirmDiscard, setConfirmDiscard] = useState(false)
    const [confirmNoSubject, setConfirmNoSubject] = useState(false)
    const dirty = useRef(false)
    const saving = useRef(false)
    const stateRef = useRef<ComposeState | null>(null)
    stateRef.current = state
    const fileInput = useRef<HTMLInputElement>(null)
    const titleId = useRef(`compose-${Math.random().toString(36).slice(2)}`).current

    useEffect(() => {
        let cancelled = false
        buildComposeState(init, jmap, identities, session.address)
            .then((s) => !cancelled && setState(s))
            .catch(() => !cancelled && setError(t('common.error')))
        return () => {
            cancelled = true
        }
        // init is fixed for the life of this window
    }, [])

    const update = (patch: Partial<ComposeState>) => {
        dirty.current = true
        setState((s) => (s ? { ...s, ...patch } : s))
    }

    const toDraft = useCallback(
        (s: ComposeState): Draft | null => {
            const identity = identities.find((i) => i.id === s.identityId) ?? identities[0]
            if (!identity) return null
            return {
                identityId: identity.id,
                from: { name: identity.name || null, email: identity.email },
                to: s.to,
                cc: s.cc,
                bcc: s.bcc,
                subject: s.subject,
                text: s.text,
                html: s.rich ? s.html : null,
                attachments: s.attachments,
                inReplyTo: s.inReplyTo,
                references: s.references,
            }
        },
        [identities],
    )

    const save = useCallback(async () => {
        const s = stateRef.current
        if (!s || !dirty.current || saving.current || !roles.drafts) return
        const draft = toDraft(s)
        if (!draft) return
        saving.current = true
        dirty.current = false
        setStatus(t('compose.draftSaving'))
        try {
            const id = await saveDraft(jmap, draft, roles.drafts, s.draftId)
            setState((cur) => (cur ? { ...cur, draftId: id } : cur))
            setStatus(t('compose.draftSaved', { time: formatShortDate(new Date().toISOString()) }))
        } catch {
            dirty.current = true
            setStatus(t('compose.draftFailed'))
        } finally {
            saving.current = false
        }
    }, [jmap, roles.drafts, toDraft])

    useEffect(() => {
        const timer = window.setInterval(() => void save(), AUTOSAVE_MS)
        return () => window.clearInterval(timer)
    }, [save])

    const mailCap = jmap.session.accounts[jmap.accountId]?.accountCapabilities?.[CAP_MAIL] as
        | { maxSizeAttachmentsPerEmail?: number }
        | undefined
    const maxTotal = mailCap?.maxSizeAttachmentsPerEmail ?? session.limits.maxUploadBytes

    const addFiles = (files: FileList | null) => {
        if (!files) return
        for (const file of Array.from(files)) {
            if (file.size > session.limits.maxUploadBytes) {
                toasts.show({
                    message: t('compose.tooLarge', { name: file.name, limit: formatBytes(session.limits.maxUploadBytes) }),
                    variant: 'danger',
                })
                continue
            }
            const current = (stateRef.current?.attachments ?? []).reduce((n, a) => n + a.size, 0)
            if (current + file.size > maxTotal) {
                toasts.show({ message: t('compose.totalTooLarge', { limit: formatBytes(maxTotal) }), variant: 'danger' })
                continue
            }
            const id = uploadSeq++
            const { promise, abort } = jmap.upload(file, (p) =>
                setUploads((list) => list.map((u) => (u.id === id ? { ...u, progress: p } : u))),
            )
            setUploads((list) => [...list, { id, name: file.name, progress: 0, abort }])
            promise
                .then((r) => {
                    dirty.current = true
                    setState((s) =>
                        s
                            ? {
                                  ...s,
                                  attachments: [
                                      ...s.attachments,
                                      { blobId: r.blobId, name: file.name, type: r.type || file.type || 'application/octet-stream', size: r.size ?? file.size },
                                  ],
                              }
                            : s,
                    )
                })
                .catch((err) => {
                    if ((err as { code?: string }).code !== 'aborted') {
                        toasts.show({ message: t('compose.uploadFailed', { name: file.name }), variant: 'danger' })
                    }
                })
                .finally(() => setUploads((list) => list.filter((u) => u.id !== id)))
        }
        if (fileInput.current) fileInput.current.value = ''
    }

    const send = (skipSubjectCheck = false) => {
        const s = stateRef.current
        if (!s) return
        setError('')
        if (!s.to.length && !s.cc.length && !s.bcc.length) {
            setError(t('compose.noRecipients'))
            return
        }
        if (!s.subject.trim() && !skipSubjectCheck) {
            setConfirmNoSubject(true)
            return
        }
        const draft = toDraft(s)
        if (!draft) {
            setError(t('common.error'))
            return
        }
        uploads.forEach((u) => u.abort())
        onSend(s, draft)
    }

    const discard = async () => {
        setConfirmDiscard(false)
        uploads.forEach((u) => u.abort())
        const id = stateRef.current?.draftId
        onClose()
        if (id) await destroyDraft(jmap, id).catch(() => {})
    }

    const close = () => {
        // Closing keeps the draft: save what is unsaved, then go.
        void save()
        uploads.forEach((u) => u.abort())
        onClose()
    }

    const titleKey =
        init.mode === 'reply' || init.mode === 'replyAll'
            ? 'compose.replyTitle'
            : init.mode === 'forward'
              ? 'compose.forwardTitle'
              : 'compose.title'

    const toggleFormat = () => {
        if (!state) return
        // The formatting bar needs the rich editor; plain text carries across, escaped.
        if (!state.rich) {
            update({ rich: true, html: textToHtml(state.text) })
            setShowFormat(true)
        } else setShowFormat((v) => !v)
    }

    const bccOpen = showBcc || (state?.bcc.length ?? 0) > 0
    const ccOpen = state?.showCc || (state?.cc.length ?? 0) > 0

    return (
        <>
            {full && !minimised ? <div className="wm-compose__scrim" onClick={() => setFull(false)} aria-hidden="true" /> : null}
            <section
                className={`wm-compose${minimised ? ' is-minimised' : ''}${full && !minimised ? ' is-full' : ''}`}
                role="dialog"
                aria-labelledby={titleId}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation()
                        if (moreOpen) setMoreOpen(false)
                        else close()
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault()
                        send()
                    }
                }}
            >
                <header
                    className="wm-compose__head"
                    onClick={(e) => {
                        // Like a mail app's compose bar: a click on the bar itself folds and unfolds the window.
                        if ((e.target as HTMLElement).closest('button, tc-icon-button')) return
                        setMinimised((m) => !m)
                    }}
                >
                    <h2 id={titleId} className="wm-compose__title">
                        {state?.subject.trim() || t(titleKey)}
                    </h2>
                    <button
                        type="button"
                        className="wm-compose__hbtn"
                        aria-label={minimised ? t('compose.restore') : t('compose.minimise')}
                        title={minimised ? t('compose.restore') : t('compose.minimise')}
                        onClick={() => setMinimised((m) => !m)}
                    >
                        <tc-icon name={minimised ? 'ChevronUp' : 'Minus'} decorative></tc-icon>
                    </button>
                    <button
                        type="button"
                        className="wm-compose__hbtn wm-compose__hbtn--full"
                        aria-label={full ? t('compose.exitFullScreen') : t('compose.fullScreen')}
                        title={full ? t('compose.exitFullScreen') : t('compose.fullScreen')}
                        onClick={() => {
                            setMinimised(false)
                            setFull((f) => !f)
                        }}
                    >
                        <tc-icon name={full ? 'Minimize2' : 'Maximize2'} decorative></tc-icon>
                    </button>
                    <button type="button" className="wm-compose__hbtn" aria-label={t('common.close')} title={t('common.close')} onClick={close}>
                        <tc-icon name="X" decorative></tc-icon>
                    </button>
                </header>
                {!state ? (
                    <div className="wm-compose__body wm-center" hidden={minimised}>
                        {error ? <p className="wm-error">{error}</p> : <tc-spinner label={t('common.loading')}></tc-spinner>}
                    </div>
                ) : (
                    <div className="wm-compose__body" hidden={minimised}>
                        <div className="wm-compose__fields">
                            {identities.length > 1 ? (
                                <label className="wm-cfield">
                                    <span className="wm-cfield__label">{t('compose.from')}</span>
                                    <select
                                        className="wm-cfield__select"
                                        value={state.identityId}
                                        onChange={(e) => update({ identityId: e.target.value })}
                                    >
                                        {identities.map((i) => (
                                            <option key={i.id} value={i.id}>
                                                {i.name ? `${i.name} <${i.email}>` : i.email}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                            <div className="wm-cfield">
                                <AddressField
                                    label={t('compose.to')}
                                    value={state.to}
                                    onChange={(to) => update({ to })}
                                    onError={setError}
                                    autoFocus={init.mode === 'new' || init.mode === 'forward'}
                                />
                                {!ccOpen || !bccOpen ? (
                                    <span className="wm-cfield__extras">
                                        {!ccOpen ? (
                                            <button type="button" className="wm-cfield__more" onClick={() => update({ showCc: true })}>
                                                {t('compose.cc')}
                                            </button>
                                        ) : null}
                                        {!bccOpen ? (
                                            <button type="button" className="wm-cfield__more" onClick={() => setShowBcc(true)}>
                                                {t('compose.bcc')}
                                            </button>
                                        ) : null}
                                    </span>
                                ) : null}
                            </div>
                            {ccOpen ? (
                                <div className="wm-cfield">
                                    <AddressField label={t('compose.cc')} value={state.cc} onChange={(cc) => update({ cc })} onError={setError} />
                                </div>
                            ) : null}
                            {bccOpen ? (
                                <div className="wm-cfield">
                                    <AddressField label={t('compose.bcc')} value={state.bcc} onChange={(bcc) => update({ bcc })} onError={setError} />
                                </div>
                            ) : null}
                            <div className="wm-cfield">
                                <input
                                    className="wm-cfield__subject"
                                    type="text"
                                    placeholder={t('compose.subject')}
                                    aria-label={t('compose.subject')}
                                    value={state.subject}
                                    onChange={(e) => update({ subject: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="wm-compose__editor">
                            {state.rich ? (
                                <RichEditor
                                    key="rich"
                                    label={t('compose.body')}
                                    initialHtml={state.html || escapeHtml('')}
                                    showToolbar={showFormat}
                                    onChange={({ html, text }) => update({ html, text })}
                                />
                            ) : (
                                <textarea
                                    className="wm-compose__text"
                                    aria-label={t('compose.body')}
                                    value={state.text}
                                    onChange={(e) => update({ text: e.target.value })}
                                    autoFocus={init.mode === 'reply' || init.mode === 'replyAll'}
                                    onFocus={(e) => {
                                        if (init.mode === 'reply' || init.mode === 'replyAll') e.currentTarget.setSelectionRange(0, 0)
                                    }}
                                />
                            )}

                            {state.attachments.length || uploads.length ? (
                                <ul className="wm-compose__files">
                                    {state.attachments.map((a) => (
                                        <li key={a.blobId} className="wm-cfile">
                                            <tc-icon name="Paperclip" decorative></tc-icon>
                                            <span className="wm-cfile__name">{a.name}</span>
                                            <span className="wm-cfile__size">({formatBytes(a.size)})</span>
                                            <button
                                                type="button"
                                                className="wm-cfile__remove"
                                                aria-label={t('compose.removeAttachment', { name: a.name })}
                                                onClick={() => update({ attachments: state.attachments.filter((x) => x !== a) })}
                                            >
                                                <tc-icon name="X" decorative></tc-icon>
                                            </button>
                                        </li>
                                    ))}
                                    {uploads.map((u) => (
                                        <li key={u.id} className="wm-cfile is-uploading">
                                            <span className="wm-cfile__name">{u.name}</span>
                                            <tc-progress value={Math.round(u.progress * 100)} aria-label={t('compose.uploading', { name: u.name })}></tc-progress>
                                            <button type="button" className="wm-cfile__remove" aria-label={t('common.cancel')} onClick={u.abort}>
                                                <tc-icon name="X" decorative></tc-icon>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>

                        {error ? (
                            <p className="wm-error wm-compose__error" role="alert">
                                {error}
                            </p>
                        ) : null}

                        <footer className="wm-compose__foot">
                            <button type="button" className="wm-compose__send" disabled={uploads.length > 0} onClick={() => send()}>
                                {t('compose.send')}
                            </button>
                            <button
                                type="button"
                                className={`wm-compose__tool${showFormat && state.rich ? ' is-on' : ''}`}
                                aria-label={t('compose.formatting')}
                                aria-pressed={showFormat && state.rich}
                                title={t('compose.formatting')}
                                onClick={toggleFormat}
                            >
                                <tc-icon name="Baseline" decorative></tc-icon>
                            </button>
                            <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                            <button
                                type="button"
                                className="wm-compose__tool"
                                aria-label={t('compose.attach')}
                                title={t('compose.attach')}
                                onClick={() => fileInput.current?.click()}
                            >
                                <tc-icon name="Paperclip" decorative></tc-icon>
                            </button>
                            <span className="wm-compose__status" aria-live="polite">
                                {status}
                            </span>
                            <span className="wm-compose__menuwrap">
                                <button
                                    type="button"
                                    className="wm-compose__tool"
                                    aria-label={t('compose.more')}
                                    title={t('compose.more')}
                                    aria-haspopup="menu"
                                    aria-expanded={moreOpen}
                                    onClick={() => setMoreOpen((o) => !o)}
                                >
                                    <tc-icon name="EllipsisVertical" decorative></tc-icon>
                                </button>
                                {moreOpen ? (
                                    <ul className="wm-compose__menu" role="menu">
                                        <li role="none">
                                            <button
                                                type="button"
                                                role="menuitemcheckbox"
                                                aria-checked={!state.rich}
                                                className="wm-compose__menuitem"
                                                onClick={() => {
                                                    setMoreOpen(false)
                                                    setShowFormat(false)
                                                    update(state.rich ? { rich: false } : { rich: true, html: textToHtml(state.text) })
                                                }}
                                            >
                                                <tc-icon name={state.rich ? 'Square' : 'SquareCheck'} decorative></tc-icon>
                                                {t('compose.plainMode')}
                                            </button>
                                        </li>
                                    </ul>
                                ) : null}
                            </span>
                            <button
                                type="button"
                                className="wm-compose__tool"
                                aria-label={t('compose.discard')}
                                title={t('compose.discard')}
                                onClick={() => setConfirmDiscard(true)}
                            >
                                <tc-icon name="Trash2" decorative></tc-icon>
                            </button>
                        </footer>
                    </div>
                )}
                <ConfirmDialog
                    open={confirmDiscard}
                    title={t('compose.discardTitle')}
                    message={t('compose.discardMessage')}
                    confirmLabel={t('compose.discard')}
                    danger
                    onConfirm={() => void discard()}
                    onCancel={() => setConfirmDiscard(false)}
                />
                <ConfirmDialog
                    open={confirmNoSubject}
                    title={t('compose.noSubjectConfirm')}
                    confirmLabel={t('compose.send')}
                    onConfirm={() => {
                        setConfirmNoSubject(false)
                        send(true)
                    }}
                    onCancel={() => setConfirmNoSubject(false)}
                />
            </section>
        </>
    )
}
