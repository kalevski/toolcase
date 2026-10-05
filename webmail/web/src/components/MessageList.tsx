import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ThreadSummary } from '../api/mail'
import { t } from '../i18n'
import { displayName, formatShortDate } from '../util/format'

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

    const people = props.showRecipients
        ? (email.to ?? []).map((a) => displayName(a)).join(', ')
        : (email.from ?? [])
              .map((a) =>
                  a.email.toLowerCase() === props.ownAddress.toLowerCase() ? t('list.me') : displayName(a),
              )
              .join(', ')
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
                <label className="wm-row__check">
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
                    <span className="wm-row__top">
                        <span className="wm-row__from">
                            {thread.unread ? <span className="wm-sr-only">{t('list.unread')}: </span> : null}
                            {thread.draft ? <span className="wm-row__draft">{t('list.draft')} </span> : null}
                            {people || t('list.unknownSender')}
                            {count > 1 ? (
                                <span className="wm-row__count" aria-label={t('list.count', { count })}>
                                    {count}
                                </span>
                            ) : null}
                        </span>
                        <time className="wm-row__date" dateTime={email.receivedAt}>
                            {formatShortDate(email.receivedAt)}
                        </time>
                    </span>
                    <span className="wm-row__subject">{subject}</span>
                    <span className="wm-row__preview">{email.preview}</span>
                </button>
                <span className="wm-row__aside">
                    {email.hasAttachment ? (
                        <tc-icon name="paperclip" label={t('list.attachment')}></tc-icon>
                    ) : null}
                    <button
                        type="button"
                        className={`wm-row__star${thread.flagged ? ' is-on' : ''}`}
                        aria-pressed={thread.flagged}
                        aria-label={thread.flagged ? t('action.unstar') : t('action.star')}
                        onClick={() => props.onToggleStar(thread)}
                    >
                        <tc-icon name="star" decorative></tc-icon>
                    </button>
                </span>
            </div>
        </li>
    )
}

export function MessageList(props: Props) {
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
        <div className="wm-list">
            <ul className="wm-list__rows">
                {props.threads.map((th) => (
                    <Row key={th.threadId} thread={th} props={props} />
                ))}
            </ul>
            <div ref={sentinel} className="wm-list__sentinel">
                {props.loading ? (
                    <tc-spinner size="sm" label={t('list.loadingMore')}></tc-spinner>
                ) : props.hasMore ? (
                    <tc-button variant="secondary" outline size="sm" onClick={props.onLoadMore}>
                        {t('list.loadMore')}
                    </tc-button>
                ) : props.threads.length > 0 ? (
                    <span className="wm-muted">{t('list.end')}</span>
                ) : null}
            </div>
        </div>
    )
}
