import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// The demo frames are 390px wide — the width the JADI.mk phone design was drawn at —
// so a pager can be compared against the canvas by eye.
const frame: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    background: 'var(--tc-surface-hover)',
    border: '1px solid var(--tc-border)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const page = (i: number): React.CSSProperties => ({
    // Every page is `flex: 0 0 100%` from the partial — nothing here sets a width.
    padding: '18px',
    minHeight: '140px',
    background: i % 2 ? 'var(--tc-surface)' : 'var(--tc-surface-muted)',
})

const DAYS = ['Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота', 'Недела']

// ── the basic pager: swipe, buttons, and one event per settled page ────────────

const BasicExample: React.FC = () => {
    const [index, setIndex] = useState(0)
    const [log, setLog] = useState<string[]>([])
    const pager = useTc<HTMLElement>(
        {},
        {
            // Fires ONCE per settled page — never mid-flick — so a handler that
            // fetches that day's plan is safe to write here.
            'tc-pager-change': (e: CustomEvent) => {
                setIndex(e.detail.index)
                setLog((l) => [`${e.detail.index + 1}/${e.detail.count}`, ...l].slice(0, 6))
            },
        },
    )
    return (
        <div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-swipe-pager ref={pager} aria-label="Дни во неделата">
                    {DAYS.map((day, i) => (
                        <div key={day} style={page(i)}>
                            <div style={{ fontWeight: 700, marginBottom: '6px' }}>{day}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                Страна {i + 1} од {DAYS.length}. Повлечете лево или десно, или
                                фокусирајте го пејџерот и користете ← / → / Home / End.
                            </div>
                        </div>
                    ))}
                    {/* @ts-ignore */}
                </tc-swipe-pager>
            </div>
            <div style={note}>
                Settled index: <code>{index}</code> · events: {log.length ? log.join(' · ') : '—'}
            </div>
            <div className="d-flex gap-2">
                <tc-button
                    size="sm"
                    variant="secondary"
                    onClick={() => (pager.current as any)?.prev()}
                >
                    prev()
                </tc-button>
                <tc-button
                    size="sm"
                    variant="secondary"
                    onClick={() => (pager.current as any)?.next()}
                >
                    next()
                </tc-button>
                <tc-button
                    size="sm"
                    variant="light"
                    onClick={() => (pager.current as any)?.goTo(6)}
                >
                    goTo(6)
                </tc-button>
                <tc-button
                    size="sm"
                    variant="light"
                    onClick={() => (pager.current as any)?.goTo(0, false)}
                >
                    goTo(0, false)
                </tc-button>
            </div>
        </div>
    )
}

// ── lazy: the far pages keep their boxes and lose their contents ───────────────

const LazyExample: React.FC = () => {
    const pager = useTc<HTMLElement>({})
    return (
        <div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-swipe-pager ref={pager} lazy aria-label="Lazy">
                    {DAYS.map((day, i) => (
                        <div key={day} style={page(i)}>
                            <div style={{ fontWeight: 700 }}>{day}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                Страна {i + 1}
                            </div>
                        </div>
                    ))}
                    {/* @ts-ignore */}
                </tc-swipe-pager>
            </div>
            <div style={note}>
                In the Elements panel every page outside <code>index-1 … index+1</code> carries{' '}
                <code>data-pager-far</code>, and its subtree is skipped via{' '}
                <code>content-visibility: hidden</code>. The nodes are <em>not</em> removed — they
                are yours, and removing them is what breaks react-dom — so the scroll width and
                every snap point stay exactly as they were.
            </div>
        </div>
    )
}

// ── gesture="none": programmatic only ─────────────────────────────────────────

const NoGestureExample: React.FC = () => {
    const pager = useTc<HTMLElement>({})
    return (
        <div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-swipe-pager ref={pager} gesture="none" loop aria-label="Недели">
                    {[1, 2, 3].map((week, i) => (
                        <div key={week} style={page(i)}>
                            <div style={{ fontWeight: 700 }}>Недела {week}</div>
                        </div>
                    ))}
                    {/* @ts-ignore */}
                </tc-swipe-pager>
            </div>
            <div style={note}>
                Dragging does nothing; the buttons and the arrow keys still work. Also{' '}
                <code>loop</code>, which wraps at the ends for <code>next()</code>/
                <code>prev()</code> — instantly, because smooth-scrolling from the last page to the
                first would animate through every page between them.
            </div>
            <div className="d-flex gap-2">
                <tc-button
                    size="sm"
                    variant="secondary"
                    onClick={() => (pager.current as any)?.prev()}
                >
                    prev()
                </tc-button>
                <tc-button
                    size="sm"
                    variant="secondary"
                    onClick={() => (pager.current as any)?.next()}
                >
                    next()
                </tc-button>
            </div>
        </div>
    )
}

const SwipePagerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="SwipePager"
                        description="Discrete horizontal paging on CSS scroll-snap: one page fills the box, the browser owns the animation, and tc-pager-change fires once per settled page. Not tc-carousel — there is no auto-play and no peek, and the index is application state."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    {/* NOTE: the pagers below are deliberately NOT nested inside
                        tc-section-card / tc-rich-page-header. Those components distribute
                        their own slots with a subtree-wide querySelectorAll, so a nested
                        [slot="…"] would be hoisted out. tc-swipe-pager has no slots of its
                        own and never re-parents a page, so it can do that to nothing. */}
                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>Swipe, buttons, keyboard — one event per page</div>
                            <BasicExample />
                        </div>
                        <div>
                            <div style={label}>lazy — only the neighbours render</div>
                            <LazyExample />
                        </div>
                        <div>
                            <div style={label}>gesture=&quot;none&quot; + loop</div>
                            <NoGestureExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SwipePagerDemo
