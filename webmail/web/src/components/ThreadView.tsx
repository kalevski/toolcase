import { useEffect, useState } from 'react'
import { getThread, patchEmails } from '../api/mail'
import type { Email } from '../jmap/types'
import { t } from '../i18n'
import { useMail } from '../state/mail'
import type { ActionKind, ActionTarget } from '../state/actions'
import { MessageCard, type ReplyMode } from './MessageCard'

type Props = {
    threadId: string
    currentMailbox: string | null
    onBack: () => void
    onAction: (kind: ActionKind, targets: ActionTarget[], opts?: { closeThread?: boolean }) => void
    onMove: (targets: ActionTarget[]) => void
    onReply: (mode: ReplyMode, email: Email) => void
    onLoaded: (emails: Email[]) => void
}

export function ThreadView({ threadId, currentMailbox, onBack, onAction, onMove, onReply, onLoaded }: Props) {
    const { jmap, roles, changeTick } = useMail()
    const [emails, setEmails] = useState<Email[] | null>(null)
    const [error, setError] = useState(false)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    useEffect(() => {
        let cancelled = false
        setError(false)
        getThread(jmap, threadId)
            .then(async (list) => {
                if (cancelled) return
                setEmails(list)
                onLoaded(list)
                setExpanded((prev) => {
                    if (prev.size && list.some((e) => prev.has(e.id))) return prev
                    const open = new Set<string>()
                    list.forEach((e, i) => {
                        if (i === list.length - 1 || !e.keywords?.$seen) open.add(e.id)
                    })
                    return open
                })
                const unseen = list.filter((e) => !e.keywords?.$seen && !e.keywords?.$draft)
                if (unseen.length) {
                    await patchEmails(
                        jmap,
                        Object.fromEntries(unseen.map((e) => [e.id, { 'keywords/$seen': true }])),
                    ).catch(() => {})
                }
            })
            .catch(() => !cancelled && setError(true))
        return () => {
            cancelled = true
        }
    }, [jmap, threadId, changeTick])

    useEffect(() => {
        setExpanded(new Set())
        setEmails(null)
    }, [threadId])

    if (error) {
        return (
            <div className="wm-read-empty">
                <p className="wm-error">{t('common.error')}</p>
                <tc-button variant="secondary" outline onClick={onBack}>
                    {t('common.back')}
                </tc-button>
            </div>
        )
    }
    if (!emails) {
        return (
            <div className="wm-read-empty">
                <tc-spinner label={t('common.loading')}></tc-spinner>
            </div>
        )
    }
    if (!emails.length) {
        return (
            <div className="wm-read-empty">
                <p>{t('read.empty')}</p>
            </div>
        )
    }

    const subject = emails[emails.length - 1].subject?.trim() || t('list.noSubject')
    const targets: ActionTarget[] = [{ members: emails, face: emails[emails.length - 1] }]
    const flagged = emails.some((e) => e.keywords?.$flagged)
    const inTrash = !!roles.trash && currentMailbox === roles.trash
    const inJunk = !!roles.junk && currentMailbox === roles.junk

    return (
        <div className="wm-thread">
            <div className="wm-toolbar" role="toolbar" aria-label={t('list.actions')}>
                <tc-icon-button icon="ChevronLeft" label={t('common.back')} ontc-click={onBack} className="wm-thread__back"></tc-icon-button>
                {roles.archive && currentMailbox !== roles.archive ? (
                    <tc-icon-button icon="Archive" label={t('action.archive')} ontc-click={() => onAction('archive', targets, { closeThread: true })}></tc-icon-button>
                ) : null}
                <tc-icon-button
                    icon="Trash2"
                    label={inTrash ? t('action.deleteForever') : t('action.delete')}
                    ontc-click={() => onAction(inTrash ? 'deleteForever' : 'delete', targets, { closeThread: true })}
                ></tc-icon-button>
                <tc-icon-button icon="FolderInput" label={t('action.move')} ontc-click={() => onMove(targets)}></tc-icon-button>
                <tc-icon-button icon="Mail" label={t('action.markUnread')} ontc-click={() => onAction('unread', targets, { closeThread: true })}></tc-icon-button>
                <tc-icon-button
                    icon={flagged ? 'StarOff' : 'Star'}
                    label={flagged ? t('action.unstar') : t('action.star')}
                    ontc-click={() => onAction(flagged ? 'unstar' : 'star', targets)}
                ></tc-icon-button>
            </div>
            <h2 className="wm-thread__subject" tabIndex={-1}>
                {subject}
            </h2>
            {emails.length > 1 ? <p className="wm-muted wm-thread__count">{t('read.thread', { count: emails.length })}</p> : null}
            <div className="wm-thread__messages">
                {emails.map((e) => (
                    <MessageCard
                        key={e.id}
                        email={e}
                        expanded={expanded.has(e.id)}
                        inJunk={inJunk}
                        onToggle={() =>
                            setExpanded((prev) => {
                                const next = new Set(prev)
                                if (next.has(e.id)) next.delete(e.id)
                                else next.add(e.id)
                                return next
                            })
                        }
                        onReply={onReply}
                        onJunk={(em) => onAction(inJunk ? 'notJunk' : 'junk', [{ members: [em], face: em }], { closeThread: emails.length === 1 })}
                    />
                ))}
            </div>
        </div>
    )
}
