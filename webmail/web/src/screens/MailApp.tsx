import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { JmapClient } from '../api/jmap'
import { sendDraft, SendFailed, type Draft } from '../api/compose'
import { getIdentities, getMailboxes, getQuota, type ThreadSummary } from '../api/mail'
import { logout, savePrefs, type Prefs, type SessionInfo } from '../api/session'
import { AccountMenu } from '../components/AccountMenu'
import { BrandMark } from '../components/BrandMark'
import { ComposeWindow, type ComposeHandle } from '../components/compose/ComposeWindow'
import type { ComposeInit, ComposeState } from '../components/compose/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FolderDialogs, type FolderDialogState } from '../components/FolderDialogs'
import { FolderNav, mailboxLabel } from '../components/FolderNav'
import { PhoneFrame, type DockTab } from '../components/PhoneFrame'
import { FoldersSheet, MoreSheet } from '../components/PhoneSheets'
import { MessageList, type SwipeKind } from '../components/MessageList'
import { MoveDialog } from '../components/MoveDialog'
import { QuotaBar } from '../components/QuotaBar'
import { SearchBar, searchFilter, type SearchBarHandle, type SearchQuery } from '../components/SearchBar'
import { SHORTCUTS, ShortcutsHelp } from '../components/ShortcutsHelp'
import { ThreadView } from '../components/ThreadView'
import type { ReplyMode } from '../components/MessageCard'
import { mailboxForRole } from '../jmap/quirks'
import type { Email, EmailFilter, Identity, Mailbox, Quota } from '../jmap/types'
import { pickLocale, setLocale, t, type MessageKey } from '../i18n'
import { runAction, targetsFromThreads, type ActionKind, type ActionTarget } from '../state/actions'
import { loadContacts, rememberAddresses, resetContacts } from '../state/contacts'
import { useLiveUpdates } from '../state/live'
import { MailContext, type MailCtx, type Roles } from '../state/mail'
import { useToasts } from '../state/toasts'
import { useThreadList } from '../state/useThreadList'
import { applyAppearance, applyTitle } from '../theme/branding'
import { usePhone } from '../util/usePhone'
import { SettingsView } from './SettingsView'

type ListFilter = 'all' | 'unread' | 'starred'
type View = { kind: 'mailbox'; id: string } | { kind: 'search'; q: SearchQuery }

const UNDO_SECONDS = 10

const DONE_KEY: Partial<Record<ActionKind, MessageKey>> = {
    archive: 'action.done.archive',
    delete: 'action.done.delete',
    deleteForever: 'action.done.deleteForever',
    move: 'action.done.move',
    junk: 'action.done.junk',
    notJunk: 'action.done.move',
    read: 'action.done.read',
    unread: 'action.done.unread',
}

const NEEDS_FOLDER: Partial<Record<ActionKind, [keyof Roles, MessageKey]>> = {
    archive: ['archive', 'folders.archive'],
    delete: ['trash', 'folders.trash'],
    junk: ['junk', 'folders.junk'],
    notJunk: ['inbox', 'folders.inbox'],
}

function isTypingTarget(el: EventTarget | null): boolean {
    const node = el as HTMLElement | null
    if (!node || !node.closest) return false
    return !!node.closest(
        'input, textarea, select, [contenteditable=""], [contenteditable="true"], .wm-compose, tc-form-input, tc-select',
    )
}

export function MailApp({
    session,
    onSignedOut,
}: {
    session: SessionInfo
    onSignedOut: (notice?: MessageKey) => void
}) {
    const toasts = useToasts()
    const jmap = useMemo(() => new JmapClient(session.jmap, session.limits.maxCallsInRequest), [session])
    const [prefs, setPrefs] = useState<Prefs>(session.prefs)
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
    const [identities, setIdentities] = useState<Identity[]>([])
    const [quota, setQuota] = useState<Quota | null>(null)
    const [view, setView] = useState<View | null>(null)
    const [listFilter, setListFilter] = useState<ListFilter>('all')
    const [threadId, setThreadId] = useState<string | null>(null)
    const [cursorId, setCursorId] = useState<string | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [settings, setSettings] = useState(false)
    const [foldersSheet, setFoldersSheet] = useState(false)
    const [moreSheet, setMoreSheet] = useState(false)
    const phone = usePhone()
    const [help, setHelp] = useState(false)
    const [compose, setCompose] = useState<{ key: number; init: ComposeInit } | null>(null)
    const [folderDialog, setFolderDialog] = useState<FolderDialogState>({ kind: 'none' })
    const [moveTargets, setMoveTargets] = useState<ActionTarget[] | null>(null)
    const [confirmForever, setConfirmForever] = useState<ActionTarget[] | null>(null)
    const [changeTick, setChangeTick] = useState(0)
    const [liveText, setLiveText] = useState('')
    const openEmails = useRef<Email[]>([])
    const inboxUnread = useRef<number | null>(null)
    const searchRef = useRef<SearchBarHandle>(null)

    // ── Appearance, locale, title ────────────────────────────────────────────
    useEffect(() => {
        applyAppearance(session.branding, prefs.theme)
        if (prefs.theme !== 'system') return
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => applyAppearance(session.branding, 'system')
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [session.branding, prefs.theme])

    useEffect(() => {
        setLocale(pickLocale(prefs.language, session.branding.defaultLanguage))
    }, [prefs.language, session.branding.defaultLanguage])

    const announce = useCallback((message: string) => {
        setLiveText('')
        window.setTimeout(() => setLiveText(message), 50)
    }, [])

    // ── Mailboxes, identities, quota ─────────────────────────────────────────
    const refreshMailboxes = useCallback(async () => {
        try {
            const { list } = await getMailboxes(jmap)
            setMailboxes(list)
            const inbox = mailboxForRole(list, 'inbox')
            if (inbox) {
                const before = inboxUnread.current
                if (before !== null && inbox.unreadEmails > before) {
                    const n = inbox.unreadEmails - before
                    announce(n > 1 ? t('shell.newMailCount', { count: n }) : t('shell.newMail'))
                }
                inboxUnread.current = inbox.unreadEmails
            }
        } catch {
            // transient; the next change or poll retries
        }
    }, [jmap, announce])

    const refreshIdentities = useCallback(async () => {
        try {
            setIdentities(await getIdentities(jmap))
        } catch {
            // compose falls back to the session address
        }
    }, [jmap])

    useEffect(() => {
        void refreshMailboxes()
        void refreshIdentities()
        getQuota(jmap)
            .then(setQuota)
            .catch(() => setQuota(null))
        return () => resetContacts()
    }, [jmap, refreshMailboxes, refreshIdentities])

    const roles: Roles = useMemo(
        () => ({
            inbox: mailboxForRole(mailboxes, 'inbox')?.id,
            drafts: mailboxForRole(mailboxes, 'drafts')?.id,
            sent: mailboxForRole(mailboxes, 'sent')?.id,
            junk: mailboxForRole(mailboxes, 'junk')?.id,
            trash: mailboxForRole(mailboxes, 'trash')?.id,
            archive: mailboxForRole(mailboxes, 'archive')?.id,
        }),
        [mailboxes],
    )

    useEffect(() => {
        if (!view && mailboxes.length) {
            setView({ kind: 'mailbox', id: roles.inbox ?? mailboxes[0].id })
        }
    }, [view, mailboxes, roles.inbox])

    useEffect(() => {
        const ids = [roles.inbox, roles.sent].filter(Boolean) as string[]
        if (ids.length) void loadContacts(jmap, session.address, ids)
    }, [jmap, roles.inbox, roles.sent, session.address])

    useEffect(() => {
        const inbox = mailboxes.find((m) => m.id === roles.inbox)
        applyTitle(session.branding, inbox?.unreadEmails ?? 0)
    }, [mailboxes, roles.inbox, session.branding])

    // ── Live updates ─────────────────────────────────────────────────────────
    const notifyChanged = useCallback(() => {
        setChangeTick((n) => n + 1)
        void refreshMailboxes()
    }, [refreshMailboxes])
    const live = useLiveUpdates(jmap, notifyChanged)

    // ── Prefs ────────────────────────────────────────────────────────────────
    const updatePrefs = useCallback(
        async (patch: Partial<Prefs>) => {
            const before = prefs
            const next = { ...prefs, ...patch }
            setPrefs(next)
            try {
                setPrefs(await savePrefs(next))
            } catch {
                setPrefs(before)
                toasts.show({ message: t('common.error'), variant: 'danger' })
            }
        },
        [prefs, toasts],
    )

    // ── List ─────────────────────────────────────────────────────────────────
    const currentMailbox = view?.kind === 'mailbox' ? view.id : null
    const filter: EmailFilter | null = useMemo(() => {
        if (!view) return null
        const base: EmailFilter = view.kind === 'mailbox' ? { inMailbox: view.id } : searchFilter(view.q)
        if (listFilter === 'unread') base.notKeyword = '$seen'
        if (listFilter === 'starred') base.hasKeyword = '$flagged'
        return base
    }, [view, listFilter])
    const list = useThreadList(jmap, filter, changeTick)
    const currentBox = mailboxes.find((m) => m.id === currentMailbox)

    const openThread = useCallback((id: string) => {
        setThreadId((cur) => {
            if (!cur) {
                try {
                    history.pushState({ wmThread: id }, '')
                } catch {
                    // ignore
                }
            }
            return id
        })
        setCursorId(id)
    }, [])

    const closeThread = useCallback(() => {
        if (history.state?.wmThread) history.back()
        else setThreadId(null)
        openEmails.current = []
    }, [])

    useEffect(() => {
        const onPop = () => {
            setThreadId(null)
            openEmails.current = []
        }
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

    const goMailbox = (id: string) => {
        setView({ kind: 'mailbox', id })
        setSettings(false)
        setFoldersSheet(false)
        setSelected(new Set())
        setListFilter('all')
        if (threadId) closeThread()
    }

    const onOpenRow = (th: ThreadSummary) => {
        if (th.draft && th.emailIds.length === 1 && currentMailbox === roles.drafts) {
            openComposeWith({ mode: 'draft', source: th.email })
            return
        }
        openThread(th.threadId)
    }

    // ── Actions ──────────────────────────────────────────────────────────────
    const doAction = useCallback(
        async (kind: ActionKind, targets: ActionTarget[], opts: { closeThread?: boolean; moveTo?: string } = {}) => {
            if (!targets.length) return
            const need = NEEDS_FOLDER[kind]
            if (need && !roles[need[0]]) {
                toasts.show({ message: t('action.noFolder', { folder: t(need[1]) }), variant: 'warning' })
                return
            }
            if (kind === 'deleteForever' && !confirmForever) {
                setConfirmForever(targets)
                return
            }
            const threadIds = new Set(
                list.threads.filter((th) => targets.some((tg) => tg.members.some((m) => th.emailIds.includes(m.id)))).map((th) => th.threadId),
            )
            const removes = ['archive', 'delete', 'deleteForever', 'move', 'junk', 'notJunk'].includes(kind)
            try {
                await runAction(jmap, kind, targets, roles, currentMailbox, opts.moveTo)
                if (removes && currentMailbox) list.removeLocal([...threadIds])
                if (opts.closeThread && threadId) closeThread()
                setSelected(new Set())
                const done = DONE_KEY[kind]
                if (done) toasts.show({ message: t(done), variant: 'success', duration: 3000, key: 'action' })
            } catch {
                toasts.show({ message: t('common.error'), variant: 'danger' })
            } finally {
                notifyChanged()
            }
        },
        [jmap, roles, currentMailbox, list, threadId, closeThread, toasts, notifyChanged, confirmForever],
    )

    const selectedThreads = list.threads.filter((th) => selected.has(th.threadId))
    const bulk = (kind: ActionKind) => void doAction(kind, targetsFromThreads(selectedThreads))
    const inTrash = !!roles.trash && currentMailbox === roles.trash
    const inJunk = !!roles.junk && currentMailbox === roles.junk

    const onSwipe = (kind: SwipeKind, th: ThreadSummary) => {
        const k: ActionKind = kind === 'archive' ? 'archive' : inTrash ? 'deleteForever' : 'delete'
        void doAction(k, targetsFromThreads([th]), { closeThread: th.threadId === threadId })
    }

    // ── Compose & send with undo ─────────────────────────────────────────────
    const composeSeq = useRef(1)
    const composeRef = useRef<ComposeHandle>(null)
    const composeBusy = useRef(false)

    /**
     * Open a compose window. If one is already open its text goes to Drafts first, the writer is told so, and
     * only then does the new one take its place; if it cannot be saved it stays open and nothing is lost.
     */
    const openComposeWith = useCallback(
        async (init: ComposeInit) => {
            if (composeBusy.current) return
            const open = composeRef.current
            if (open) {
                // That very draft is the open window: there is nothing to replace.
                if (init.mode === 'draft' && open.draftId() === init.source.id) return
                composeBusy.current = true
                try {
                    const result = await open.flush()
                    if (result === 'failed') {
                        toasts.show({ message: t('compose.keepOpen'), variant: 'danger', duration: 6000 })
                        return
                    }
                    if (result === 'saved') {
                        toasts.show({ message: t('compose.savedToDrafts'), variant: 'success', duration: 3000, key: 'draft-saved' })
                    }
                    notifyChanged()
                } finally {
                    composeBusy.current = false
                }
            }
            setCompose({ key: composeSeq.current++, init })
        },
        [toasts, notifyChanged],
    )

    const reply = useCallback(
        (mode: ReplyMode, email: Email) => openComposeWith({ mode, source: email }),
        [openComposeWith],
    )

    const sendWithUndo = (state: ComposeState, draft: Draft) => {
        setCompose(null)
        if (!roles.drafts) {
            toasts.show({ message: t('compose.sendFailed'), variant: 'danger' })
            setCompose({ key: composeSeq.current++, init: { mode: 'restore', state } })
            return
        }
        let remaining = UNDO_SECONDS
        let cancelled = false
        const interval = window.setInterval(() => {
            remaining -= 1
            if (remaining > 0) toasts.update(toastId, { message: t('compose.sending', { seconds: remaining }) })
        }, 1000)
        const timer = window.setTimeout(async () => {
            window.clearInterval(interval)
            toasts.dismiss(toastId)
            if (cancelled) return
            try {
                await sendDraft(jmap, draft, roles.drafts!, roles.sent ?? null, state.draftId)
                rememberAddresses(session.address, [...draft.to, ...draft.cc, ...draft.bcc])
                toasts.show({ message: t('compose.sent'), variant: 'success', duration: 3000 })
                announce(t('compose.sent'))
            } catch (err) {
                const draftId = err instanceof SendFailed ? err.draftId : state.draftId
                toasts.show({ message: t('compose.sendFailed'), variant: 'danger', duration: 8000 })
                void openComposeWith({ mode: 'restore', state: { ...state, draftId } })
            } finally {
                notifyChanged()
            }
        }, UNDO_SECONDS * 1000)
        const toastId = toasts.show({
            message: t('compose.sending', { seconds: remaining }),
            duration: 0,
            key: `send-${timer}`,
            action: {
                label: t('common.undo'),
                onClick: () => {
                    cancelled = true
                    window.clearTimeout(timer)
                    window.clearInterval(interval)
                    // A message started since the send is saved to Drafts before the unsent one comes back.
                    void openComposeWith({ mode: 'restore', state })
                    announce(t('compose.undone'))
                },
            },
        })
    }

    // ── Keyboard shortcuts ───────────────────────────────────────────────────
    const keyState = useRef({ list, threadId, cursorId, selectedThreads, currentMailbox, inTrash })
    keyState.current = { list, threadId, cursorId, selectedThreads, currentMailbox, inTrash }
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
            if (isTypingTarget(e.target)) return
            if (document.querySelector('tc-confirm-dialog[open], tc-bottom-sheet[open]')) return
            const s = keyState.current
            const rows = s.list.threads
            const pos = rows.findIndex((r) => r.threadId === (s.threadId ?? s.cursorId))
            const current = (): ActionTarget[] => {
                if (s.selectedThreads.length) return targetsFromThreads(s.selectedThreads)
                if (s.threadId && openEmails.current.length) {
                    return [{ members: openEmails.current, face: openEmails.current[openEmails.current.length - 1] }]
                }
                const row = rows.find((r) => r.threadId === s.cursorId)
                return row ? targetsFromThreads([row]) : []
            }
            const last = openEmails.current[openEmails.current.length - 1]
            switch (e.key) {
                case 'c':
                    openComposeWith({ mode: 'new' })
                    break
                case 'j':
                case 'k': {
                    const next = rows[Math.max(0, Math.min(rows.length - 1, pos + (e.key === 'j' ? 1 : -1)))]
                    if (!next) return
                    if (s.threadId) openThread(next.threadId)
                    else setCursorId(next.threadId)
                    if (pos === -1 && rows.length) setCursorId(rows[0].threadId)
                    break
                }
                case 'o':
                case 'Enter':
                    if (!s.threadId && s.cursorId && e.key === 'o') openThread(s.cursorId)
                    else return
                    break
                case 'e':
                    void doAction('archive', current(), { closeThread: true })
                    break
                case '#':
                    void doAction(s.inTrash ? 'deleteForever' : 'delete', current(), { closeThread: true })
                    break
                case 'r':
                case 'a':
                case 'f':
                    if (!last) return
                    reply(e.key === 'r' ? 'reply' : e.key === 'a' ? 'replyAll' : 'forward', last)
                    break
                case '/':
                    searchRef.current?.focus()
                    break
                case '?':
                    setHelp(true)
                    break
                case 'Escape':
                    if (s.threadId) closeThread()
                    else if (s.selectedThreads.length) setSelected(new Set())
                    else return
                    break
                default:
                    return
            }
            e.preventDefault()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [doAction, openComposeWith, openThread, closeThread, reply])

    // ── Sign out / password ──────────────────────────────────────────────────
    const signOut = async () => {
        try {
            // An open message goes to Drafts first, so signing out does not throw its text away.
            await composeRef.current?.flush()
            await logout()
        } catch {
            // the session is gone either way from our side
        }
        onSignedOut('login.signedOut')
    }

    const ctx: MailCtx = {
        session,
        jmap,
        prefs,
        updatePrefs,
        mailboxes,
        roles,
        refreshMailboxes,
        identities,
        refreshIdentities,
        openCompose: openComposeWith,
        announce,
        changeTick,
        notifyChanged,
    }

    const listTitle =
        view?.kind === 'search' ? t('search.results') : currentBox ? mailboxLabel(currentBox) : t('common.loading')
    const showRecipients = !!currentMailbox && (currentMailbox === roles.sent || currentMailbox === roles.drafts)
    const allSelected = list.threads.length > 0 && selected.size === list.threads.length
    const searching = view?.kind === 'search'

    const folders = (
        <>
            <FolderNav
                mailboxes={mailboxes}
                currentId={currentMailbox}
                onSelect={goMailbox}
                onManage={(m) => setFolderDialog({ kind: 'manage', mailbox: m })}
                onCreate={() => setFolderDialog({ kind: 'create' })}
            />
            <QuotaBar quota={quota} />
        </>
    )

    const search = (
        <SearchBar
            ref={searchRef}
            mailboxes={mailboxes}
            query={view?.kind === 'search' ? view.q : null}
            onSearch={(q) => {
                setView({ kind: 'search', q })
                setSettings(false)
                setSelected(new Set())
                if (threadId) closeThread()
            }}
            onClear={() => {
                if (view?.kind === 'search') goMailbox(roles.inbox ?? mailboxes[0]?.id ?? '')
            }}
        />
    )

    const filterChips = (
        <div className="wm-chips" role="group" aria-label={t('list.filters')}>
            {(['all', 'unread', 'starred'] as ListFilter[]).map((f) => (
                <tc-chip key={f} size="md" selected={listFilter === f} ontc-click={() => setListFilter(f)}>
                    {t(f === 'all' ? 'list.filterAll' : f === 'unread' ? 'list.filterUnread' : 'list.filterStarred')}
                </tc-chip>
            ))}
        </div>
    )

    // What the list holds, in the dashboard's mono meta voice: the unread count and the folder's size.
    const listMeta = searching
        ? ''
        : [
              currentBox && currentBox.unreadEmails > 0 ? t('folders.unread', { count: currentBox.unreadEmails }) : '',
              currentBox && currentBox.totalEmails > 0 ? t('list.count', { count: currentBox.totalEmails }) : '',
          ]
              .filter(Boolean)
              .join(' · ')

    const bulkBar = (showTitle: boolean) => (
        <div className="wm-bulk" role="toolbar" aria-label={t('list.actions')}>
            <label className="wm-check">
                <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allSelected}
                    ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && !allSelected
                    }}
                    onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(list.threads.map((x) => x.threadId)))
                    }
                    aria-label={t('list.selectAll')}
                />
            </label>
            {selected.size ? (
                <>
                    <span className="wm-bulk__count" aria-live="polite">
                        {t('list.selected', { count: selected.size })}
                    </span>
                    {roles.archive && currentMailbox !== roles.archive ? (
                        <tc-icon-button icon="Archive" size="small" label={t('action.archive')} ontc-click={() => bulk('archive')}></tc-icon-button>
                    ) : null}
                    <tc-icon-button
                        icon="Trash2"
                        size="small"
                        label={inTrash ? t('action.deleteForever') : t('action.delete')}
                        ontc-click={() => bulk(inTrash ? 'deleteForever' : 'delete')}
                    ></tc-icon-button>
                    <tc-icon-button icon="MailOpen" size="small" label={t('action.markRead')} ontc-click={() => bulk('read')}></tc-icon-button>
                    <tc-icon-button icon="Mail" size="small" label={t('action.markUnread')} ontc-click={() => bulk('unread')}></tc-icon-button>
                    <tc-icon-button
                        icon="FolderInput"
                        size="small"
                        label={t('action.move')}
                        ontc-click={() => setMoveTargets(targetsFromThreads(selectedThreads))}
                    ></tc-icon-button>
                    <tc-icon-button
                        icon="ShieldAlert"
                        size="small"
                        label={inJunk ? t('action.notJunk') : t('action.junk')}
                        ontc-click={() => bulk(inJunk ? 'notJunk' : 'junk')}
                    ></tc-icon-button>
                    <tc-icon-button icon="X" size="small" label={t('list.clearSelection')} ontc-click={() => setSelected(new Set())}></tc-icon-button>
                </>
            ) : (
                <>
                    {showTitle ? (
                        <h1 className="wm-bulk__title">
                            <span>{listTitle}</span>
                            {listMeta ? <span className="wm-bulk__meta">{listMeta}</span> : null}
                        </h1>
                    ) : (
                        <span className="wm-bulk__count wm-bulk__meta">{listMeta}</span>
                    )}
                    <tc-icon-button icon="RefreshCw" size="small" label={t('common.retry')} ontc-click={() => notifyChanged()}></tc-icon-button>
                </>
            )}
        </div>
    )

    const listBody = (
        <>
            {list.error && !list.threads.length ? (
                <div className="wm-list-empty">
                    <p className="wm-error">{t('common.error')}</p>
                    <tc-button variant="secondary" outline onClick={() => void list.refresh()}>
                        {t('common.retry')}
                    </tc-button>
                </div>
            ) : (
                <MessageList
                    threads={list.threads}
                    loading={list.loading}
                    hasMore={list.hasMore}
                    emptyText={view?.kind === 'search' ? t('list.emptySearch') : t('list.empty')}
                    selected={selected}
                    openId={threadId}
                    cursorId={cursorId}
                    ownAddress={session.address}
                    showRecipients={showRecipients}
                    canArchive={!!roles.archive && currentMailbox !== roles.archive}
                    onLoadMore={list.loadMore}
                    onOpen={onOpenRow}
                    onToggleSelect={(th) =>
                        setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(th.threadId)) next.delete(th.threadId)
                            else next.add(th.threadId)
                            return next
                        })
                    }
                    onToggleStar={(th) => void doAction(th.flagged ? 'unstar' : 'star', targetsFromThreads([th]))}
                    onSwipe={onSwipe}
                />
            )}
        </>
    )

    const readPane = (
        <section className="wm-read-pane" aria-label={t('read.bodyFrame')}>
            {threadId ? (
                <ThreadView
                    threadId={threadId}
                    currentMailbox={currentMailbox}
                    onBack={closeThread}
                    onAction={(kind, targets, opts) => void doAction(kind, targets, opts)}
                    onMove={(targets) => setMoveTargets(targets)}
                    onReply={reply}
                    onLoaded={(emails) => (openEmails.current = emails)}
                />
            ) : (
                <div className="wm-read-empty">
                    <tc-empty-state
                        icon="mail"
                        heading={t('read.empty')}
                        description={
                            currentBox && !searching
                                ? currentBox.unreadEmails > 0
                                    ? t('read.emptyUnread', { count: currentBox.unreadEmails, folder: mailboxLabel(currentBox) })
                                    : t('read.emptyAllRead', { folder: mailboxLabel(currentBox) })
                                : undefined
                        }
                    ></tc-empty-state>
                    <dl className="wm-read-empty__keys wm-hide-coarse" aria-label={t('shortcuts.title')}>
                        {(['j', 'r', 'e', '/', '?'] as const).map((key) => {
                            const entry = SHORTCUTS.find(([k]) => k === key)
                            return entry ? (
                                <div key={key}>
                                    <dt>
                                        <tc-kbd>{key}</tc-kbd>
                                    </dt>
                                    <dd>{t(entry[1])}</dd>
                                </div>
                            ) : null
                        })}
                    </dl>
                </div>
            )}
        </section>
    )

    const settingsView = (
        <SettingsView onBack={() => setSettings(false)} onPasswordChanged={() => onSignedOut('login.passwordChanged')} />
    )

    const overlays = (
        <>
            {compose ? (
                <ComposeWindow
                    ref={composeRef}
                    key={compose.key}
                    init={compose.init}
                    onClose={(pending) => {
                        setCompose(null)
                        notifyChanged()
                        // The draft write is still under way when the window closes; refresh once it is done.
                        void Promise.resolve(pending).finally(notifyChanged)
                    }}
                    onSend={sendWithUndo}
                />
            ) : null}

            <FolderDialogs state={folderDialog} onClose={() => setFolderDialog({ kind: 'none' })} />
            <MoveDialog
                open={!!moveTargets}
                currentId={currentMailbox}
                onClose={() => setMoveTargets(null)}
                onPick={(id) => {
                    const targets = moveTargets ?? []
                    setMoveTargets(null)
                    void doAction('move', targets, { moveTo: id, closeThread: !!threadId })
                }}
            />
            <ConfirmDialog
                open={!!confirmForever}
                title={t('action.deleteForeverTitle')}
                message={t('action.deleteForeverMessage', { count: confirmForever?.length ?? 0 })}
                confirmLabel={t('action.deleteForever')}
                danger
                onCancel={() => setConfirmForever(null)}
                onConfirm={() => {
                    const targets = confirmForever ?? []
                    void doAction('deleteForever', targets, { closeThread: true }).finally(() => setConfirmForever(null))
                }}
            />
            <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
            <div className="wm-sr-only" role="status" aria-live="polite" aria-atomic="true">
                {liveText}
            </div>
        </>
    )

    if (phone) {
        const inboxUnreadCount = mailboxes.find((m) => m.id === roles.inbox)?.unreadEmails ?? 0
        const tabs: DockTab[] = [
            { id: 'inbox', label: t('folders.inbox'), icon: 'inbox', badge: inboxUnreadCount },
            ...(roles.sent ? [{ id: 'sent', label: t('folders.sent'), icon: 'send' }] : []),
            { id: 'folders', label: t('folders.title'), icon: 'folder' },
            { id: 'more', label: t('shell.more'), icon: 'menu' },
        ]
        const activeTab = settings
            ? 'more'
            : currentMailbox && currentMailbox === roles.sent
              ? 'sent'
              : !currentMailbox || currentMailbox === roles.inbox
                ? 'inbox'
                : 'folders'
        const onTab = (id: string) => {
            if (id === 'inbox' && roles.inbox) goMailbox(roles.inbox)
            else if (id === 'sent' && roles.sent) goMailbox(roles.sent)
            else if (id === 'folders') setFoldersSheet(true)
            else if (id === 'more') setMoreSheet(true)
        }
        const detail = settings || !!threadId
        const onBack = () => {
            if (settings) setSettings(false)
            else if (threadId) closeThread()
            else goMailbox(roles.inbox ?? mailboxes[0]?.id ?? '')
        }
        const dataKey = settings ? 'settings' : threadId ? `thread-${threadId}` : `list-${currentMailbox ?? 'search'}`

        return (
            <MailContext.Provider value={ctx}>
                <PhoneFrame
                    variant={detail || searching ? 'back' : 'title'}
                    title={settings ? t('settings.title') : listTitle}
                    subtitle={settings ? undefined : session.address}
                    dataKey={dataKey}
                    onBack={onBack}
                    offline={live.polling ? t('shell.offline', { seconds: live.pollSeconds }) : undefined}
                    band={
                        detail ? null : (
                            <>
                                {search}
                                {filterChips}
                            </>
                        )
                    }
                    tabs={tabs}
                    activeId={activeTab}
                    onTab={onTab}
                    fab={detail ? null : { label: t('shell.compose'), onPress: () => openComposeWith({ mode: 'new' }) }}
                    overlay={
                        <>
                            <FoldersSheet
                                open={foldersSheet}
                                onClose={() => setFoldersSheet(false)}
                                mailboxes={mailboxes}
                                currentId={currentMailbox}
                                quota={quota}
                                onSelect={goMailbox}
                                onManage={(m) => {
                                    setFoldersSheet(false)
                                    setFolderDialog({ kind: 'manage', mailbox: m })
                                }}
                                onCreate={() => {
                                    setFoldersSheet(false)
                                    setFolderDialog({ kind: 'create' })
                                }}
                            />
                            <MoreSheet
                                open={moreSheet}
                                onClose={() => setMoreSheet(false)}
                                branding={session.branding}
                                address={session.address}
                                onSettings={() => setSettings(true)}
                                onSignOut={() => void signOut()}
                            />
                        </>
                    }
                >
                    {settings ? (
                        settingsView
                    ) : threadId ? (
                        readPane
                    ) : (
                        <section className="wm-list-pane" aria-label={listTitle}>
                            {bulkBar(false)}
                            {listBody}
                        </section>
                    )}
                </PhoneFrame>
                {overlays}
            </MailContext.Provider>
        )
    }

    const appClass = [
        'wm-app',
        `wm-layout-${prefs.layout}`,
        `wm-density-${prefs.density}`,
        threadId ? 'has-thread' : '',
        settings ? 'is-settings' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <MailContext.Provider value={ctx}>
            <div className={appClass}>
                <header className="wm-bar">
                    <div className="wm-bar__brand">
                        <BrandMark branding={session.branding} />
                    </div>
                    <div className="wm-bar__search">{search}</div>
                    <div className="wm-bar__actions">
                        <AccountMenu
                            address={session.address}
                            branding={session.branding}
                            onSettings={() => setSettings(true)}
                            onShortcuts={() => setHelp(true)}
                            onSignOut={() => void signOut()}
                        />
                    </div>
                </header>

                {live.polling ? (
                    <div className="wm-offline" role="status">
                        {t('shell.offline', { seconds: live.pollSeconds })}
                    </div>
                ) : null}

                <aside className="wm-sidebar">
                    <tc-button variant="primary" block className="wm-sidebar__compose" onClick={() => openComposeWith({ mode: 'new' })}>
                        <tc-icon name="SquarePen" size="15" decorative></tc-icon> {t('shell.compose')}
                    </tc-button>
                    {folders}
                </aside>

                {settings ? (
                    <main className="wm-main wm-main--settings">{settingsView}</main>
                ) : (
                    <main className="wm-main">
                        <section className="wm-list-pane" aria-label={listTitle}>
                            <header className="wm-list-head">
                                {bulkBar(true)}
                                <div className="wm-list-head__chips">{filterChips}</div>
                            </header>
                            {listBody}
                        </section>
                        {readPane}
                    </main>
                )}

                {overlays}
            </div>
        </MailContext.Provider>
    )
}
