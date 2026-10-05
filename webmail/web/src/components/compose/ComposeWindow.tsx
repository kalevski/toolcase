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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    return (
        <section
            className={`wm-compose${minimised ? ' is-minimised' : ''}`}
            role="dialog"
            aria-labelledby={titleId}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation()
                    close()
                }
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    send()
                }
            }}
        >
            <header className="wm-compose__head">
                <h2 id={titleId} className="wm-compose__title">
                    {state?.subject.trim() || t(titleKey)}
                </h2>
                <tc-icon-button
                    icon={minimised ? 'Maximize2' : 'Minimize2'}
                    label={minimised ? t('compose.restore') : t('compose.minimise')}
                    className="wm-compose__min"
                    ontc-click={() => setMinimised((m) => !m)}
                ></tc-icon-button>
                <tc-icon-button icon="X" label={t('common.close')} ontc-click={close}></tc-icon-button>
            </header>
            {!state ? (
                <div className="wm-compose__body wm-center">
                    {error ? <p className="wm-error">{error}</p> : <tc-spinner label={t('common.loading')}></tc-spinner>}
                </div>
            ) : (
                <div className="wm-compose__body" hidden={minimised}>
                    {identities.length > 1 ? (
                        <tc-select
                            label={t('compose.from')}
                            value={state.identityId}
                            ontc-change={(e) => update({ identityId: String(e.detail.value) })}
                        >
                            {identities.map((i) => (
                                <tc-option key={i.id} value={i.id}>
                                    {i.name ? `${i.name} <${i.email}>` : i.email}
                                </tc-option>
                            ))}
                        </tc-select>
                    ) : null}
                    <div className="wm-compose__row">
                        <AddressField
                            label={t('compose.to')}
                            value={state.to}
                            onChange={(to) => update({ to })}
                            onError={setError}
                            autoFocus={init.mode === 'new' || init.mode === 'forward'}
                        />
                        {!state.showCc ? (
                            <button type="button" className="wm-linkbtn" onClick={() => update({ showCc: true })}>
                                {t('compose.showCcBcc')}
                            </button>
                        ) : null}
                    </div>
                    {state.showCc ? (
                        <>
                            <AddressField label={t('compose.cc')} value={state.cc} onChange={(cc) => update({ cc })} onError={setError} />
                            <AddressField label={t('compose.bcc')} value={state.bcc} onChange={(bcc) => update({ bcc })} onError={setError} />
                        </>
                    ) : null}
                    <tc-form-input
                        label={t('compose.subject')}
                        value={state.subject}
                        ontc-change={(e) => update({ subject: String(e.detail.value ?? '') })}
                    ></tc-form-input>

                    <div className="wm-compose__mode">
                        <tc-switch
                            label={t('compose.richText')}
                            checked={state.rich}
                            ontc-change={(e) => {
                                const rich = e.detail.value === true
                                // Switching modes carries the text across; plain → rich escapes it.
                                update(rich ? { rich, html: textToHtml(state.text) } : { rich })
                            }}
                        ></tc-switch>
                    </div>
                    {state.rich ? (
                        <RichEditor
                            key="rich"
                            label={t('compose.body')}
                            initialHtml={state.html || escapeHtml('')}
                            onChange={({ html, text }) => update({ html, text })}
                        />
                    ) : (
                        <textarea
                            className="form-control wm-compose__text"
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
                                <li key={a.blobId} className="wm-file">
                                    <tc-icon name="paperclip" decorative></tc-icon>
                                    <span className="wm-file__name">{a.name}</span>
                                    <span className="wm-muted">{formatBytes(a.size)}</span>
                                    <tc-icon-button
                                        icon="X"
                                        size="small"
                                        label={t('compose.removeAttachment', { name: a.name })}
                                        ontc-click={() => update({ attachments: state.attachments.filter((x) => x !== a) })}
                                    ></tc-icon-button>
                                </li>
                            ))}
                            {uploads.map((u) => (
                                <li key={u.id} className="wm-file">
                                    <span className="wm-file__name">{t('compose.uploading', { name: u.name })}</span>
                                    <tc-progress value={Math.round(u.progress * 100)} aria-label={t('compose.uploading', { name: u.name })}></tc-progress>
                                    <tc-icon-button icon="X" size="small" label={t('common.cancel')} ontc-click={u.abort}></tc-icon-button>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {error ? (
                        <p className="wm-error" role="alert">
                            {error}
                        </p>
                    ) : null}

                    <footer className="wm-compose__foot">
                        <tc-button variant="primary" disabled={uploads.length > 0} onClick={() => send()}>
                            {t('compose.send')}
                        </tc-button>
                        <input
                            ref={fileInput}
                            type="file"
                            multiple
                            hidden
                            onChange={(e) => addFiles(e.target.files)}
                        />
                        <tc-icon-button icon="Paperclip" label={t('compose.attach')} ontc-click={() => fileInput.current?.click()}></tc-icon-button>
                        <span className="wm-compose__status wm-muted" aria-live="polite">
                            {status}
                        </span>
                        <tc-icon-button icon="Trash2" label={t('compose.discard')} ontc-click={() => setConfirmDiscard(true)}></tc-icon-button>
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
    )
}
