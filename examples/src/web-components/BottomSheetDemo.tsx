import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// The frames are 390x844 — the size the JADI.mk phone design was drawn at — so each
// sheet can be compared against `mobile_design/JADI.mk Mobile.dc.html` screens 1g
// (filters) and 1l (paywall) by eye.
//
// Sheet CONTENT here is inline-styled straight from that canvas on purpose: chips, a
// range track and a select are their own library work (task 13), and hand-written
// values keep this demo about the sheet itself — its scrim, its handle, its drag,
// its footer — rather than about whichever control happens to be inside it.

const frame: React.CSSProperties = {
    position: 'relative',
    width: '390px',
    height: '844px', // the canvas's own frame, so a screenshot compares 1:1 with 1g
    maxWidth: '100%',
    overflow: 'hidden',
    border: '1px solid var(--tc-border)',
}

const rowBtn: React.CSSProperties = {
    display: 'block',
    flex: 'none',
    width: '100%',
    padding: '13px 4px',
    border: 0,
    borderBottom: '1px dashed #e5ddd0',
    background: 'none',
    font: "600 14px 'Source Sans 3', system-ui, sans-serif",
    color: '#2c2620',
    textAlign: 'left',
    cursor: 'pointer',
}

const chip = (active: boolean): React.CSSProperties => ({
    borderRadius: '999px',
    background: active ? 'rgba(242,183,5,.16)' : '#fff',
    border: `1px solid ${active ? 'rgba(242,183,5,.5)' : '#e5e2dc'}`,
    color: active ? '#8a6d2f' : '#7d766c',
    font: `${active ? 600 : 400} 12px 'Source Sans 3', system-ui, sans-serif`,
    padding: '6px 12px',
    cursor: 'pointer',
})

// 1g's footer pair: a 104px outline „Откажи" beside a flex:1 amber „Примени".
const cancelBtn: React.CSSProperties = {
    width: '104px',
    height: '46px',
    borderRadius: '6px',
    border: '1px solid rgba(34,48,26,.26)',
    background: 'none',
    font: "600 14px 'Source Sans 3', system-ui, sans-serif",
    color: '#44503a',
    cursor: 'pointer',
}

const applyBtn: React.CSSProperties = {
    flex: '1',
    height: '46px',
    borderRadius: '6px',
    border: 0,
    background: '#f2b705',
    boxShadow: '0 12px 28px -12px rgba(242,183,5,.5)',
    font: "600 14px 'Source Sans 3', system-ui, sans-serif",
    color: '#2e2400',
    cursor: 'pointer',
}

const pane: React.CSSProperties = {
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '11px',
}

// The blurred page behind the sheet on 1g: three skeleton cards with a category rule.
// `flex: none` matters: the pane is a flex column, and a shrinkable 112px card
// silently collapses to fit instead of making the pane scroll — which would leave
// the scroll-lock half of this demo proving nothing.
const skeleton = (accent: string): React.CSSProperties => ({
    flex: 'none',
    height: '112px',
    borderRadius: '10px',
    background: '#fdfaf4',
    border: '1px solid #e5e2dc',
    borderTop: `3px solid ${accent}`,
})

type SheetName = 'filters' | 'tall' | 'input' | 'snaps' | 'locked' | null

// ── The design's own sheet: screen 1g ─────────────────────────────────────────

const Main: React.FC = () => {
    const [sheet, setSheet] = useState<SheetName>(null)
    // The sub-sheet is INDEPENDENT state, not another value of `sheet`: the filters
    // sheet stays open underneath it. That is the whole point of the two-deep stack.
    const [sortOpen, setSortOpen] = useState(false)
    const [sort, setSort] = useState('Најнови прво')
    const [tags, setTags] = useState<string[]>(['Посно'])
    const [log, setLog] = useState<string[]>([])
    const note = (line: string) => setLog((l) => [line, ...l].slice(0, 3))

    const toggleTag = (tag: string) =>
        setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))

    // Every sheet reports the same three events. `reason` is the interesting one:
    // scrim / drag / escape / action.
    const events = (name: string) => ({
        'tc-sheet-close': (e: CustomEvent) => {
            note(`${name} close → ${e.detail.reason}`)
            // The element has already begun its exit; this only keeps React in step.
            setSheet((current) => (current === name ? null : current))
        },
        'tc-sheet-snap': (e: CustomEvent) => note(`${name} snap → ${e.detail.snap}%`),
    })

    const filters = useTc<HTMLElement>({}, events('filters'))
    const sortSheet = useTc<HTMLElement>(
        {},
        {
            'tc-sheet-close': (e: CustomEvent) => {
                note(`sort close → ${e.detail.reason}`)
                setSortOpen(false)
            },
        },
    )
    const tall = useTc<HTMLElement>({}, events('tall'))
    const input = useTc<HTMLElement>({}, events('input'))
    const snaps = useTc<HTMLElement>({}, events('snaps'))
    const locked = useTc<HTMLElement>({}, events('locked'))

    return (
        <div style={frame}>
            {/* The JADI.mk design IS the sunshine theme — cream surfaces, warm shadow
                tint, Playfair/Source Sans, the cream scrim. Without this wrapper the
                sheet renders in the default theme and cannot be compared with 1g.
                tc-theme is display:contents, so it changes no layout. */}
            {/* @ts-ignore */}
            <tc-theme name="sunshine">
                {/* @ts-ignore an embedded preview, so the shell is sized by its frame */}
                <tc-mobile-shell data-key="bottom-sheet-demo" style={{ height: '100%' }}>
                    {/* @ts-ignore */}
                    <tc-app-bar slot="header" variant="title" heading="Рецепти" subheading="437" />
                    <div style={pane}>
                        <div
                            style={{
                                font: "400 12px 'Source Sans 3', system-ui, sans-serif",
                                color: '#6b6459',
                            }}
                        >
                            {log.length ? log.join(' · ') : 'Отворете лист оддолу.'}
                        </div>
                        <button style={rowBtn} onClick={() => setSheet('filters')}>
                            Филтри — screen 1g, with a nested sort sheet
                        </button>
                        <button style={rowBtn} onClick={() => setSheet('tall')}>
                            Long body — scrolls internally, drags from the top
                        </button>
                        <button style={rowBtn} onClick={() => setSheet('input')}>
                            With a text field — footer clears the keyboard
                        </button>
                        <button style={rowBtn} onClick={() => setSheet('snaps')}>
                            snap="40,90" — two rest positions
                        </button>
                        <button style={rowBtn} onClick={() => setSheet('locked')}>
                            dismissible="false" — no scrim tap, no Escape
                        </button>
                        {[
                            '#a4472f',
                            '#4e6b3c',
                            '#3c5d6b',
                            '#8a6d2f',
                            '#6b3c5f',
                            '#3c6b64',
                            '#94502e',
                        ].map((accent) => (
                            <div key={accent} style={skeleton(accent)} />
                        ))}
                    </div>

                    <div slot="overlay">
                        {/* ── 1g, verbatim ──────────────────────────────────────── */}
                        {/* @ts-ignore */}
                        <tc-bottom-sheet ref={filters} open={sheet === 'filters' || undefined}>
                            <div slot="header">
                                <h2 className="tc-sheet-title">Филтри</h2>
                                <button
                                    type="button"
                                    className="tc-sheet-action"
                                    onClick={() => setTags([])}
                                >
                                    Исчисти
                                </button>
                            </div>
                            <div>
                                <div className="tc-sheet-section">
                                    <span className="tc-sheet-section-label">Папка</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {['Секојдневни', 'Посни', 'Зимница'].map((f, i) => (
                                            <button key={f} type="button" style={chip(i === 0)}>
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* A native range: a drag started on it must reach the
                                slider, never the sheet. That is the NO_DRAG_SELECTOR. */}
                                <div className="tc-sheet-section" style={{ gap: '11px' }}>
                                    <div
                                        style={{ display: 'flex', justifyContent: 'space-between' }}
                                    >
                                        <span className="tc-sheet-section-label">Вкупно време</span>
                                        <span
                                            style={{
                                                font: "600 12px 'Source Sans 3', system-ui, sans-serif",
                                                color: '#20301a',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            до 45 мин
                                        </span>
                                    </div>
                                    <input type="range" min={5} max={120} defaultValue={45} />
                                </div>
                                <div className="tc-sheet-section">
                                    <span className="tc-sheet-section-label">Ознаки</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {['Посно', 'Без глутен', 'Вегетаријанско', 'Брзо'].map(
                                            (tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    style={chip(tags.includes(tag))}
                                                    onClick={() => toggleTag(tag)}
                                                >
                                                    {tag}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                                <div className="tc-sheet-section">
                                    <span className="tc-sheet-section-label">Подреди</span>
                                    {/* Opens a SECOND sheet from inside the first — the
                                    stack's only sanctioned depth. */}
                                    <button
                                        type="button"
                                        onClick={() => setSortOpen(true)}
                                        style={{
                                            borderRadius: '6px',
                                            background: '#f1e6ce',
                                            border: '1px solid rgba(34,48,26,.14)',
                                            boxShadow: 'inset 0 1px 2px rgba(54,44,18,.06)',
                                            height: '42px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0 12px',
                                            font: "400 13px 'Source Sans 3', system-ui, sans-serif",
                                            color: '#2c2620',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>{sort}</span>
                                        <span aria-hidden="true">⌄</span>
                                    </button>
                                </div>
                            </div>
                            <div slot="footer">
                                <button style={cancelBtn} onClick={() => setSheet(null)}>
                                    Откажи
                                </button>
                                <button style={applyBtn} onClick={() => setSheet(null)}>
                                    Примени ({tags.length})
                                </button>
                            </div>
                            {/* @ts-ignore */}
                        </tc-bottom-sheet>

                        {/* ── The sub-sheet: depth 1, one scrim, Escape closes this one ── */}
                        {/* @ts-ignore */}
                        <tc-bottom-sheet
                            ref={sortSheet}
                            heading="Подреди"
                            open={sortOpen || undefined}
                        >
                            <div>
                                {[
                                    'Најнови прво',
                                    'Најстари прво',
                                    'Најкратко време',
                                    'Азбучно',
                                ].map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        style={rowBtn}
                                        onClick={() => {
                                            setSort(option)
                                            setSortOpen(false)
                                        }}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            {/* @ts-ignore */}
                        </tc-bottom-sheet>

                        {/* ── Nested scrolling ──────────────────────────────────── */}
                        {/* @ts-ignore */}
                        <tc-bottom-sheet
                            ref={tall}
                            heading="Состојки"
                            snap="70"
                            open={sheet === 'tall' || undefined}
                        >
                            <div>
                                {Array.from({ length: 30 }, (_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: '13px 0',
                                            borderBottom: '1px dashed #e5ddd0',
                                            font: "400 13px 'Source Sans 3', system-ui, sans-serif",
                                            color: '#2c2620',
                                        }}
                                    >
                                        Ред {i + 1} — scroll here, then drag down from the very top.
                                    </div>
                                ))}
                            </div>
                            <div slot="footer">
                                <button style={applyBtn} onClick={() => setSheet(null)}>
                                    Затвори
                                </button>
                            </div>
                            {/* @ts-ignore */}
                        </tc-bottom-sheet>

                        {/* ── Keyboard-aware footer ─────────────────────────────── */}
                        {/* @ts-ignore */}
                        <tc-bottom-sheet
                            ref={input}
                            heading="Нова листа"
                            open={sheet === 'input' || undefined}
                        >
                            <div>
                                <div className="tc-sheet-section">
                                    <span className="tc-sheet-section-label">Име на листата</span>
                                    {/* 16px minimum, or iOS Safari zooms the page on
                                        focus. `data-autofocus`, not React's `autoFocus`:
                                        react-dom does not render that as an attribute —
                                        it calls .focus() itself at mount, when the sheet
                                        is still display:none and the call does nothing. */}
                                    <input
                                        data-autofocus
                                        placeholder="Пазар за среда"
                                        style={{
                                            height: '40px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(34,48,26,.14)',
                                            background: '#f1e6ce',
                                            padding: '0 12px',
                                            font: "400 16px 'Source Sans 3', system-ui, sans-serif",
                                            color: '#2c2620',
                                        }}
                                    />
                                </div>
                            </div>
                            <div slot="footer">
                                <button style={cancelBtn} onClick={() => setSheet(null)}>
                                    Откажи
                                </button>
                                <button style={applyBtn} onClick={() => setSheet(null)}>
                                    Зачувај
                                </button>
                            </div>
                            {/* @ts-ignore */}
                        </tc-bottom-sheet>

                        {/* ── Snap points ───────────────────────────────────────── */}
                        {/* @ts-ignore */}
                        <tc-bottom-sheet
                            ref={snaps}
                            heading="Планер"
                            snap="40,90"
                            open={sheet === 'snaps' || undefined}
                        >
                            <div>
                                <p
                                    style={{
                                        font: "400 13px/1.45 'Source Sans 3', system-ui, sans-serif",
                                        color: '#6b6459',
                                        margin: 0,
                                    }}
                                >
                                    Opens at 40%. Drag up to 90%, drag down to 40%, drag down again
                                    to dismiss — or flick, which steps one snap per flick.
                                    <code> tc-sheet-snap</code> reports the index.
                                </p>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <div key={i} style={skeleton('#4e6b3c')} />
                                ))}
                            </div>
                            {/* @ts-ignore */}
                        </tc-bottom-sheet>

                        {/* ── Not dismissible ──────────────────────────────────── */}
                        {/* @ts-ignore */}
                        <tc-bottom-sheet
                            ref={locked}
                            heading="Потврдете"
                            dismissible="false"
                            open={sheet === 'locked' || undefined}
                        >
                            <div>
                                <p
                                    style={{
                                        font: "400 13px/1.45 'Source Sans 3', system-ui, sans-serif",
                                        color: '#6b6459',
                                        margin: 0,
                                    }}
                                >
                                    The scrim, Escape and a drag all refuse. A drag past the rest
                                    position resists at a third of the finger's distance, which is
                                    how the surface says so without a message. Only the button
                                    closes it.
                                </p>
                            </div>
                            <div slot="footer">
                                <button style={applyBtn} onClick={() => setSheet(null)}>
                                    Разбирам
                                </button>
                            </div>
                            {/* @ts-ignore */}
                        </tc-bottom-sheet>
                    </div>
                </tc-mobile-shell>
                {/* @ts-ignore */}
            </tc-theme>
        </div>
    )
}

// ── Outside a shell: the body-scroll-lock fallback ────────────────────────────

const NoShell: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [target, setTarget] = useState('—')
    const sheet = useTc<HTMLElement>(
        {},
        {
            'tc-sheet-open': (e: Event) => {
                // `lockTarget` reports which of the two lock paths ran. Inside a shell
                // it is the pane; here there is no shell, so <body> gets pinned.
                const el = e.currentTarget as unknown as { lockTarget?: string }
                setTarget(el?.lockTarget ?? '—')
            },
            'tc-sheet-close': () => setOpen(false),
        },
    )

    return (
        <div style={{ ...frame, height: 'auto', padding: '14px' }}>
            {/* @ts-ignore the same theme as the framed example above, so the two read
                as one system rather than as two different components */}
            <tc-theme name="sunshine">
                <p
                    style={{
                        font: "400 13px/1.45 'Source Sans 3', system-ui, sans-serif",
                        color: '#6b6459',
                    }}
                >
                    No <code>tc-mobile-shell</code> here, so the document itself scrolls and the
                    sheet falls back to pinning <code>&lt;body&gt;</code> with a compensating{' '}
                    <code>top</code>
                    . Scroll this page halfway, open the sheet, close it: the offset is exactly
                    where it was. Nothing is blurred — there is no pane to blur.
                    <br />
                    <code>lockTarget</code> during the last open: <strong>{target}</strong>
                </p>
                <button style={applyBtn} onClick={() => setOpen(true)}>
                    Отвори лист
                </button>
                {/* @ts-ignore */}
                <tc-bottom-sheet ref={sheet} heading="Без школка" open={open || undefined}>
                    <div>
                        <p
                            style={{
                                font: "400 13px/1.45 'Source Sans 3', system-ui, sans-serif",
                                color: '#6b6459',
                                margin: 0,
                            }}
                        >
                            This sheet is <code>position: fixed</code> against the window, and its
                            scrim is mounted as its own sibling.
                        </p>
                    </div>
                    <div slot="footer">
                        <button style={applyBtn} onClick={() => setOpen(false)}>
                            Затвори
                        </button>
                    </div>
                    {/* @ts-ignore */}
                </tc-bottom-sheet>
                {/* @ts-ignore */}
            </tc-theme>
        </div>
    )
}

const BottomSheetDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="BottomSheet"
                        description="The phone modal surface: a grab handle, a warm cream scrim over a blurred page, drag-to-dismiss with real physics, snap points, a focus trap and a scroll lock that knows whether it is inside an app shell."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>
                </div>
            </div>
            <div className="row g-4">
                <div className="col-12 col-lg-6">
                    <tc-section-card title-text="In a shell">
                        <Main />
                    </tc-section-card>
                </div>
                <div className="col-12 col-lg-6">
                    <tc-section-card title-text="Without a shell">
                        <NoShell />
                    </tc-section-card>
                </div>
            </div>
        </div>
    </div>
)

export default BottomSheetDemo
