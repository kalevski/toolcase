import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Screen `1j` („Планер") of the JADI.mk phone design. 390px is the width it was
// composed at; the 320px frame below is the narrowest phone we support.
const frame: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

const narrowFrame: React.CSSProperties = { ...frame, width: '320px' }

const pane: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

// The Macedonian week — the letters are the APP's, because which letter a weekday
// starts with is locale knowledge and two of these seven are the same glyph.
const SHORT = ['П', 'В', 'С', 'Ч', 'П', 'С', 'Н']
const NAMES = ['Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота', 'Недела']

// `a11yLabel` names the day; the status word is appended by the element from the
// message catalog, so „Четврток 4, 2 310 од 1 900 ккал" is read „…, over target".
const day = (i: number, state: string, kcal?: string) => ({
    id: String(i + 1),
    short: SHORT[i],
    label: String(i + 1),
    state,
    a11yLabel: kcal ? `${NAMES[i]} ${i + 1}, ${kcal}` : `${NAMES[i]} ${i + 1}`,
})

// ── 1j, verbatim: two planned days, today, an over-target day, three empty ────

const week1j = [
    day(0, 'planned', '1 880 од 1 900 ккал'),
    day(1, 'planned', '1 910 од 1 900 ккал'),
    day(2, 'today', '1 840 од 1 900 ккал'),
    day(3, 'over', '2 310 од 1 900 ккал'),
    day(4, 'empty'),
    day(5, 'empty'),
    day(6, 'empty'),
]

const CanvasExample: React.FC = () => {
    const [active, setActive] = useState('3')
    const strip = useTc<HTMLElement>(
        { days: week1j },
        {
            'tc-day-strip-change': (e: CustomEvent) => setActive(e.detail.id),
        },
    )
    return (
        <div>
            <div style={label}>1j — the canvas, where today happens to be the selected day</div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-day-strip ref={strip} active-id={active} aria-label="Недела 3" />
                <div style={pane}>
                    Selected: <code>{active}</code>. Arrows move and activate, Home / End jump to
                    the ends. Day 3 is <em>today</em> and <em>selected</em> at once — which is
                    exactly the coincidence the next example takes apart.
                </div>
            </div>
        </div>
    )
}

// ── The point of the element: selection ≠ state ───────────────────────────────

const SelectionExample: React.FC = () => {
    const [active, setActive] = useState('1')
    const strip = useTc<HTMLElement>(
        { days: week1j },
        {
            'tc-day-strip-change': (e: CustomEvent) => setActive(e.detail.id),
        },
    )
    return (
        <div>
            <div style={label}>Selection is a ring, state is a fill</div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-day-strip ref={strip} active-id={active} aria-label="Избор наспроти состојба" />
                <div style={pane}>
                    Monday starts selected while Wednesday is still today. Tap day 4 — the red
                    over-target cell keeps its fill and takes the terracotta ring, and Wednesday
                    keeps its amber. Nothing about „today" moves when the selection does.
                </div>
            </div>
            <div style={note}>
                The ring is terracotta and not the amber <code>--tc-app-accent</code> for two
                reasons: an amber ring around the amber <code>today</code> fill is invisible, and
                amber is this design's CTA colour on at most two elements per screen. The selected
                day's weekday letter also goes <code>400</code> → <code>700</code>, which survives
                greyscale and colour blindness on its own.
            </div>
        </div>
    )
}

// ── Every state, including the one the design does not draw ───────────────────

const allStates = [
    day(0, 'empty'),
    day(1, 'planned', '1 880 од 1 900 ккал'),
    day(2, 'partial', '900 од 1 900 ккал'),
    day(3, 'today', '1 840 од 1 900 ккал'),
    day(4, 'over', '2 310 од 1 900 ккал'),
    { ...day(5, 'empty'), disabled: true },
    { ...day(6, 'empty'), disabled: true },
]

const StatesExample: React.FC = () => {
    const strip = useTc<HTMLElement>({ days: allStates })
    return (
        <div>
            <div style={label}>All five states, plus two days outside the plan</div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-day-strip ref={strip} active-id="2" aria-label="Состојби" />
                <div style={pane}>
                    Left to right: empty · planned · <strong>partial</strong> · today · over ·
                    disabled · disabled. <code>partial</code> is <em>not a design value</em> — the
                    canvas shows four states and a real week has a fifth. It reuses{' '}
                    <code>planned</code>'s fill with a 1px inset outline in <code>planned</code>'s
                    ink, so „planned but incomplete" reads as a variation of planned rather than as
                    a fifth hue nobody can name.
                </div>
            </div>
        </div>
    )
}

// ── An empty week, a fortnight, a work week ───────────────────────────────────

const emptyWeek = SHORT.map((_, i) => day(i, 'empty'))

const fortnight = [
    ...week1j,
    ...SHORT.map((_, i) => ({
        ...day(i, 'empty'),
        id: `n${i + 1}`,
        label: String(i + 8),
        a11yLabel: `${NAMES[i]} ${i + 8}`,
    })),
]

const workWeek = week1j.slice(0, 5)

const ColumnsExample: React.FC = () => {
    const empty = useTc<HTMLElement>({ days: emptyWeek })
    const two = useTc<HTMLElement>({ days: fortnight })
    const five = useTc<HTMLElement>({ days: workWeek })
    return (
        <div>
            <div style={label}>An empty week · a fortnight · a five-day week</div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-day-strip ref={empty} aria-label="Празна недела" />
                <div style={pane}>
                    No <code>active-id</code> at all: nothing is ringed, every letter is faint. An
                    empty week is legible as empty.
                </div>
                {/* @ts-ignore */}
                <tc-day-strip ref={two} active-id="3" columns={7} aria-label="Две недели" />
                <div style={pane}>
                    Fourteen days at <code>columns="7"</code> — two rows of seven, not fourteen 26px
                    slivers. <code>columns</code> is a <em>column</em> count, which is what makes
                    that possible.
                </div>
                {/* @ts-ignore */}
                <tc-day-strip ref={five} active-id="3" columns={5} aria-label="Работна недела" />
                <div style={pane}>
                    Five days at <code>columns="5"</code>. Leaving it at the default 7 would render
                    five narrow cells and two empty tracks.
                </div>
            </div>
        </div>
    )
}

// ── 320px: the accepted trade-off ─────────────────────────────────────────────

const NarrowExample: React.FC = () => {
    const strip = useTc<HTMLElement>({ days: week1j })
    return (
        <div>
            <div style={label}>320px — seven columns of ~37px</div>
            <div style={narrowFrame}>
                {/* @ts-ignore */}
                <tc-day-strip ref={strip} active-id="4" aria-label="320px" />
                <div style={pane}>
                    Under the 44px guideline <em>horizontally</em>, and accepted: a week is seven
                    days whatever the viewport, the design's own strip is the same, and a scrolling
                    strip would cost the „whole week at a glance" that is the entire point. The
                    vertical axis compensates — each column is a ≥44px target (~48px on these
                    values) even though the coloured box is 30px.
                </div>
            </div>
        </div>
    )
}

// ── The whole of 1j's day: strip, meal cards, add slot ────────────────────────
//
// The meal cards are tc-list-section + tc-check-row (task 09's recorded decision: there
// is no tc-meal-card), so this is the one place all four elements of the screen stand
// together for a like-for-like comparison against the canvas.

const MEALS = [
    {
        heading: 'Појадок',
        icon: 'sun',
        meta: '420 ккал',
        tone: '#8a6d2f',
        rows: [{ name: 'Овесна каша со ореви', hint: '1 порција · 420 ккал', done: true }],
    },
    {
        heading: 'Ручек',
        icon: 'flame',
        meta: '628 ккал',
        tone: '#a4472f',
        rows: [
            { name: 'Тавче гравче', hint: '1 порција · 486 ккал', done: false },
            { name: 'Шопска салата', hint: '1 порција · 142 ккал', done: false },
        ],
    },
    {
        heading: 'Вечера',
        icon: 'layers',
        meta: '792 ккал',
        tone: '#3c5d6b',
        rows: [
            { name: 'Ресторан — грил', hint: 'свој оброк · ~792 ккал · без макроа', done: false },
        ],
    },
]

// 1j's meal row: 600 14px name over an 11px hint. tc-check-row's own defaults are 1h's
// 14.5px / 11.5px, so the two sizes come in as knobs.
const mealRowStyle = {
    '--bs-check-row-label-font': '600 14px var(--m-body)',
    '--bs-check-row-hint-font': '400 11px var(--m-body)',
} as React.CSSProperties

const ScreenExample: React.FC = () => {
    const [active, setActive] = useState('3')
    const strip = useTc<HTMLElement>(
        { days: week1j },
        {
            'tc-day-strip-change': (e: CustomEvent) => setActive(e.detail.id),
        },
    )
    return (
        <div>
            <div style={label}>1j — the strip over the day it selects</div>
            <div style={frame}>
                {/* @ts-ignore */}
                <tc-day-strip ref={strip} active-id={active} aria-label="Недела 3" />
                <div
                    style={{
                        padding: '13px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '11px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div
                            style={{
                                font: 'var(--m-font-card-title)',
                                color: 'var(--sun-emphasis, var(--tc-text))',
                            }}
                        >
                            {NAMES[Number(active.replace('n', '')) - 1] ?? 'Ден'}
                        </div>
                        <div
                            style={{
                                font: 'var(--m-font-btn-sm)',
                                fontVariantNumeric: 'tabular-nums',
                                color: 'var(--sun-leaf, var(--tc-success))',
                            }}
                        >
                            1 840 / 1 900 ккал
                        </div>
                    </div>
                    {MEALS.map((meal) => (
                        // @ts-ignore
                        <tc-list-section
                            key={meal.heading}
                            heading={meal.heading}
                            icon={meal.icon}
                            meta={meal.meta}
                            style={{ '--bs-list-section-tone': meal.tone } as React.CSSProperties}
                        >
                            {meal.rows.map((row) => (
                                // @ts-ignore
                                <tc-check-row
                                    key={row.name}
                                    shape="circle"
                                    tone="success"
                                    no-strike
                                    no-dim
                                    label={row.name}
                                    hint={row.hint}
                                    checked={row.done || undefined}
                                    style={mealRowStyle}
                                />
                            ))}
                            {/* @ts-ignore */}
                        </tc-list-section>
                    ))}
                    {/* @ts-ignore */}
                    <tc-add-slot label="Ужина" />
                </div>
            </div>
            <div style={note}>
                Four elements, no glue CSS: <code>tc-day-strip</code> owns the band and its
                hairline, <code>tc-list-section</code> passes its row rhythm into each{' '}
                <code>tc-check-row</code>'s own knob, and <code>tc-add-slot</code> stands in for the
                card the day has no entries for.
            </div>
        </div>
    )
}

const DayStripDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <CanvasExample />
        <SelectionExample />
        <StatesExample />
        <ColumnsExample />
        <NarrowExample />
        <ScreenExample />
    </div>
)

export default DayStripDemo
