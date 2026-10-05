import { useState } from 'react'
import { createMailbox, destroyMailbox, renameMailbox } from '../api/mail'
import type { Mailbox } from '../jmap/types'
import { t } from '../i18n'
import { useMail } from '../state/mail'
import { useToasts } from '../state/toasts'
import { Dialog } from './Dialog'
import { mailboxLabel, orderedMailboxes } from './FolderNav'

export type FolderDialogState =
    | { kind: 'none' }
    | { kind: 'create' }
    | { kind: 'manage'; mailbox: Mailbox }

export function FolderDialogs({
    state,
    onClose,
}: {
    state: FolderDialogState
    onClose: () => void
}) {
    const { jmap, mailboxes, refreshMailboxes } = useMail()
    const toasts = useToasts()
    const [name, setName] = useState('')
    const [parent, setParent] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [lastKey, setLastKey] = useState('')

    const key = state.kind === 'manage' ? `m:${state.mailbox.id}` : state.kind
    if (key !== lastKey) {
        setLastKey(key)
        setName(state.kind === 'manage' ? state.mailbox.name : '')
        setParent('')
        setError('')
        setConfirmDelete(false)
    }

    const close = () => {
        if (!busy) onClose()
    }

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true)
        setError('')
        try {
            await fn()
            await refreshMailboxes()
            toasts.show({ message: t('common.saved'), variant: 'success', duration: 2500 })
            onClose()
        } catch (err) {
            const type = (err as { type?: string }).type
            setError(type === 'mailboxHasEmail' ? t('folders.deleteNotEmpty') : t('common.error'))
        } finally {
            setBusy(false)
        }
    }

    const open = state.kind !== 'none'
    const manage = state.kind === 'manage' ? state.mailbox : null
    const parents = orderedMailboxes(mailboxes).filter((n) => n.mailbox.myRights?.mayCreateChild !== false)

    return (
        <Dialog
            open={open}
            title={manage ? t('folders.manage') : t('folders.new')}
            onClose={close}
            size="sm"
            footer={
                <>
                    <tc-button variant="secondary" outline onClick={close}>
                        {t('common.cancel')}
                    </tc-button>
                    {manage && !confirmDelete ? (
                        <tc-button
                            variant="danger"
                            outline
                            disabled={busy || manage.myRights?.mayDelete === false}
                            onClick={() => setConfirmDelete(true)}
                        >
                            {t('common.delete')}
                        </tc-button>
                    ) : null}
                    {manage && confirmDelete ? (
                        <tc-button
                            variant="danger"
                            loading={busy}
                            onClick={() => run(() => destroyMailbox(jmap, manage.id))}
                        >
                            {t('common.delete')}
                        </tc-button>
                    ) : (
                        <tc-button
                            variant="primary"
                            loading={busy}
                            disabled={!name.trim()}
                            onClick={() =>
                                run(() =>
                                    manage
                                        ? renameMailbox(jmap, manage.id, name.trim())
                                        : createMailbox(jmap, name.trim(), parent || null),
                                )
                            }
                        >
                            {manage ? t('common.rename') : t('common.create')}
                        </tc-button>
                    )}
                </>
            }
        >
            {confirmDelete && manage ? (
                <p>{t('folders.deleteMessage', { name: manage.name })}</p>
            ) : (
                <div className="wm-stack">
                    <tc-form-input
                        label={t('folders.name')}
                        value={name}
                        required
                        ontc-change={(e) => setName(String(e.detail.value ?? ''))}
                    ></tc-form-input>
                    {!manage ? (
                        <tc-select
                            label={t('folders.parent')}
                            value={parent}
                            ontc-change={(e) => setParent(String(e.detail.value ?? ''))}
                        >
                            <tc-option value="">{t('folders.topLevel')}</tc-option>
                            {parents.map(({ mailbox: m, depth }) => (
                                <tc-option key={m.id} value={m.id}>
                                    {' '.repeat(depth) + mailboxLabel(m)}
                                </tc-option>
                            ))}
                        </tc-select>
                    ) : null}
                </div>
            )}
            {error ? (
                <p className="wm-error" role="alert">
                    {error}
                </p>
            ) : null}
        </Dialog>
    )
}
