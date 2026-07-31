import React from 'react'

// Screen `1j` („Планер") of the JADI.mk phone design: one day, three meal cards, each
// tinted with its own meal-time hue. 390px is the width it was composed at.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '13px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '11px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

// The APP's meal-time map — the hue is domain knowledge, so it comes in as a custom
// property rather than as a `tone` attribute. Icons per design-reference.md §5:
// sun = breakfast, flame = lunch, layers = dinner.
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

// The meal row's own type: 600 14px name over an 11px hint. Passed as knobs rather
// than baked in, because tc-check-row's defaults are 1h's 14.5px/11.5px.
const mealRowStyle = {
    '--bs-check-row-label-font': '600 14px var(--m-body)',
    '--bs-check-row-hint-font': '400 11px var(--m-body)',
} as React.CSSProperties

// ── 1j: the day's three meal cards ────────────────────────────────────────────

const PlannerExample: React.FC = () => (
    <div>
        <div style={label}>1j — the planner's meal cards</div>
        <div style={phone}>
            {MEALS.map((meal) => (
                <tc-list-section
                    key={meal.heading}
                    heading={meal.heading}
                    icon={meal.icon}
                    meta={meal.meta}
                    style={{ '--bs-list-section-tone': meal.tone } as React.CSSProperties}
                >
                    {meal.rows.map((row) => (
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
                </tc-list-section>
            ))}
        </div>
        <div style={note}>
            One knob — `--bs-list-section-tone` — colours the icon and the eyebrow together, which
            is what makes three stacked cards read as three different meals rather than three copies
            of one card.
        </div>
    </div>
)

// ── Composition: plain rows, a footer, no header ──────────────────────────────

const CompositionExample: React.FC = () => (
    <div>
        <div style={label}>Composition</div>
        <div style={phone}>
            <tc-list-section heading="Состојки" icon="carrot" meta="7 ставки">
                <div>Тетовски грав · 500 г</div>
                <div>Кромид · 3 главици</div>
                <div>Црвен пипер · 1.5 суп. лажица</div>
                <div slot="footer" style={{ fontWeight: 600, color: 'var(--tc-app-accent)' }}>
                    Додај состојка
                </div>
            </tc-list-section>

            <tc-list-section heading="Без фигура" icon="scale" />

            <tc-list-section>
                <div>Нема наслов — само рамка и ритам на редови</div>
                <div>Втор ред, со цртичка одозгора</div>
            </tc-list-section>
        </div>
        <div style={note}>
            A footer is ordered last by CSS rather than appended, so it is never re-parented. With
            no heading, no icon and no meta the band is not rendered at all — an empty 34px strip is
            worse than no strip.
        </div>
    </div>
)

const ListSectionDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <PlannerExample />
        <CompositionExample />
    </div>
)

export default ListSectionDemo
