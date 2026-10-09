import { Fragment, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { ThreadSummary } from '../api/mail'
import type { EmailAddress } from '../jmap/types'
import { locale, t } from '../i18n'
import { displayName, formatShortDate } from '../util/format'

/**
 * Who a row is from (or to). A lone bare address reads as its local part with the domain muted, so
 * "carol@example.test" scans as "carol" first; names and lists stay as they are.
 */
function peopleOf(list: EmailAddress[], own: string): { node: ReactNode; initial: string } {
    const mine = (a: EmailAddress) => a.email.toLowerCase() === own.toLowerCase()
    if (list.length === 1 && !list[0].name && !mine(list[0])) {
        const at = list[0].email.lastIndexOf('@')
        if (at > 0) {
            const local = list[0].email.slice(0, at)
            return {
                node: (
                    <>
                        {local}
                        <span className="wm-row__domain">{list[0].email.slice(at)}</span>
                    </>
                ),
                initial: local.slice(0, 1),
            }
        }
    }
    const names = list.map((a) => (mine(a) ? t('list.me') : displayName(a)))
    return { node: names.join(', '), initial: (names[0] ?? '').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 1) }
}

/** The day heading a row falls under: Today, Yesterday, Earlier this week, then month and year. */
function groupOf(iso: string, now: Date): { key: string; label: string } {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return { key: 'unknown', label: '' }
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((day(now) - day(d)) / 86_400_000)
    if (diff <= 0) return { key: 'today', label: t('list.groupToday') }
    if (diff === 1) return { key: 'yesterday', label: t('list.groupYesterday') }
    if (diff < 7) return { key: 'week', label: t('list.groupWeek') }
    return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }),
    }
}

export type SwipeKind = 'archive' | 'delete'

type Props = {
    threads: ThreadSummary[]
    loading: boolean
    hasMore: boolean
    emptyText: string
    selected: Set<string>
    openId: string | null
    cursorId: string | null
    ownAddress: string
    showRecipients: boolean
    canArchive: boolean
    onLoadMore: () => void
    onOpen: (t: ThreadSummary) => void
    onToggleSelect: (t: ThreadSummary) => void
    onToggleStar: (t: ThreadSummary) => void
    onSwipe: (kind: SwipeKind, t: ThreadSummary) => void
}

const SWIPE_COMMIT = 96

function Row({
    thread,
    props,
}: {
    thread: ThreadSummary
    props: Props
}) {
    const { email } = thread
    const [dx, setDx] = useState(0)
    const start = useRef<{ x: number; y: number; id: number; swiping: boolean } | null>(null)
    const suppressClick = useRef(false)
    const selected = props.selected.has(thread.threadId)
    const open = props.openId === thread.threadId
    const cursor = props.cursorId === thread.threadId

    const { node: people, initial } = peopleOf(
        (props.showRecipients ? email.to : email.from) ?? [],
        props.ownAddress,
    )
    const subject = email.subject?.trim() || t('list.noSubject')
    const count = thread.emailIds.length

    const onPointerDown = (e: ReactPointerEvent) => {
        if (e.pointerType !== 'touch') return
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false }
    }
    const onPointerMove = (e: ReactPointerEvent) => {
        const s = start.current
        if (!s || s.id !== e.pointerId) return
        const ddx = e.clientX - s.x
        const ddy = e.clientY - s.y
        if (!s.swiping) {
            if (Math.abs(ddy) > 12) {
                start.current = null
                return
            }
            if (Math.abs(ddx) > 12) {
                s.swiping = true
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            }
        }
        if (s.swiping) {
            const limited = !props.canArchive && ddx > 0 ? 0 : ddx
            setDx(Math.max(-160, Math.min(160, limited)))
        }
    }
    const onPointerEnd = () => {
        const s = start.current
        start.current = null
        if (s?.swiping) {
            suppressClick.current = true
            window.setTimeout(() => (suppressClick.current = false), 50)
            if (dx >= SWIPE_COMMIT) props.onSwipe('archive', thread)
            else if (dx <= -SWIPE_COMMIT) props.onSwipe('delete', thread)
        }
        setDx(0)
    }

    const classes = [
        'wm-row',
        thread.unread ? 'is-unread' : '',
        open ? 'is-open' : '',
        selected ? 'is-selected' : '',
        cursor ? 'is-cursor' : '',
        dx !== 0 ? 'is-swiping' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <li className={classes} data-thread={thread.threadId}>
            <div className="wm-row__swipe" aria-hidden="true">
                <span className={`wm-row__swipe-left${dx > 0 ? ' is-visible' : ''}`}>
                    <tc-icon name="archive" decorative></tc-icon> {t('list.swipeArchive')}
                </span>
                <span className={`wm-row__swipe-right${dx < 0 ? ' is-visible' : ''}`}>
                    {t('list.swipeDelete')} <tc-icon name="trash-2" decorative></tc-icon>
                </span>
            </div>
            <div
                className="wm-row__inner"
                style={dx ? { transform: `translateX(${dx}px)` } : undefined}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
            >
                {/* The sender's initial; it becomes the checkbox on hover, on focus and while selecting. */}
                <label className="wm-check wm-row__lead">
                    <span className="wm-row__avatar" aria-hidden="true">
                        {initial || '?'}
                    </span>
                    <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selected}
                        onChange={() => props.onToggleSelect(thread)}
                        aria-label={`${t('list.select')}: ${subject}`}
                    />
                </label>
                <button
                    type="button"
                    className="wm-row__main"
                    aria-current={open ? 'true' : undefined}
                    onClick={() => {
                        if (!suppressClick.current) props.onOpen(thread)
                    }}
                >
                    <span className="wm-row__from">
                        <span className="wm-row__people">
                            {thread.unread ? <span className="wm-sr-only">{t('list.unread')}: </span> : null}
                            {people || t('list.unknownSender')}
                        </span>
                        {thread.draft ? <span className="wm-row__draft">{t('list.draft')}</span> : null}
                        {count > 1 ? (
                            <span className="wm-row__count" aria-label={t('list.count', { count })}>
                                {count}
                            </span>
                        ) : null}
                    </span>
                    <time className="wm-row__date" dateTime={email.receivedAt}>
                        {formatShortDate(email.receivedAt)}
                    </time>
                    <span className="wm-row__text">
                        <span className="wm-row__subject">{subject}</span>
                        <span className="wm-row__preview">{email.preview}</span>
                    </span>
                </button>
                <span className="wm-row__aside">
                    {email.hasAttachment ? (
                        <tc-icon name="paperclip" size="14" label={t('list.attachment')}></tc-icon>
                    ) : null}
                    <button
                        type="button"
                        className={`wm-row__star${thread.flagged ? ' is-on' : ''}`}
                        aria-pressed={thread.flagged}
                        aria-label={thread.flagged ? t('action.unstar') : t('action.star')}
                        onClick={() => props.onToggleStar(thread)}
                    >
                        <tc-icon name="star" size="15" decorative></tc-icon>
                    </button>
                </span>
            </div>
        </li>
    )
}

export function MessageList(props: Props) {
    const now = new Date()
    const sentinel = useRef<HTMLDivElement>(null)
    const loadMore = useRef(props.onLoadMore)
    loadMore.current = props.onLoadMore

    useEffect(() => {
        const el = sentinel.current
        if (!el || !props.hasMore) return
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) loadMore.current()
            },
            { rootMargin: '400px 0px' },
        )
        io.observe(el)
        return () => io.disconnect()
    }, [props.hasMore, props.threads.length])

    useEffect(() => {
        if (!props.cursorId) return
        const row = document.querySelector(`.wm-row[data-thread="${CSS.escape(props.cursorId)}"]`)
        row?.scrollIntoView({ block: 'nearest' })
    }, [props.cursorId])

    if (!props.loading && props.threads.length === 0) {
        return (
            <div className="wm-list-empty">
                <tc-empty-state icon="inbox" heading={props.emptyText}></tc-empty-state>
            </div>
        )
    }

    return (
        <div className={`wm-list${props.selected.size ? ' is-selecting' : ''}`}>
            <ul className="wm-list__rows">
                {props.threads.map((th, i) => {
                    const group = groupOf(th.email.receivedAt, now)
                    const prev = i > 0 ? groupOf(props.threads[i - 1].email.receivedAt, now).key : ''
                    return (
                        <Fragment key={th.threadId}>
                            {group.label && group.key !== prev ? (
                                <li className="wm-group" role="presentation">
                                    <span>{group.label}</span>
                                </li>
                            ) : null}
                            <Row thread={th} props={props} />
                        </Fragment>
                    )
                })}
            </ul>
            <div ref={sentinel} className="wm-list__sentinel">
                {props.loading ? (
                    <tc-spinner size="sm" label={t('list.loadingMore')}></tc-spinner>
                ) : props.hasMore ? (
                    <tc-button variant="secondary" outline size="sm" onClick={props.onLoadMore}>
                        {t('list.loadMore')}
                    </tc-button>
                ) : props.threads.length > 0 ? (
                    <span>{t('list.end')}</span>
                ) : null}
            </div>
        </div>
    )
}
