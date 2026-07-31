import React, { useState } from 'react'

// Screen `1j` („Планер") of the JADI.mk phone design draws one of these for ужина — the
// meal the day has no entries for. 390px is the width it was composed at.
const frame: React.CSSProperties = {
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

// A filled sibling, so the slot can be compared against the object it stands in for —
// same width, same 10px radius, same 44px-ish height, dashed instead of solid.
const filled: React.CSSProperties = {
    padding: '11px 12px',
    background: 'var(--tc-surface)',
    border: '1px solid var(--tc-border)',
    borderRadius: 'var(--m-radius-card, 10px)',
    font: 'var(--m-font-label, 600 0.8125rem var(--tc-font-sans))',
    color: 'var(--tc-text)',
}

// ── 1j: a slot among filled cards ─────────────────────────────────────────────

const CanvasExample: React.FC = () => {
    const [added, setAdded] = useState<string[]>([])
    return (
        <div>
            <div style={label}>1j — „Ужина", the meal with no entries</div>
            <div style={frame}>
                <div style={filled}>Појадок · 420 ккал</div>
                <div style={filled}>Ручек · 628 ккал</div>
                <div style={filled}>Вечера · 792 ккал</div>
                {added.map((name) => (
                    <div key={name} style={filled}>
                        {name} · 0 ккал
                    </div>
                ))}
                {/* @ts-ignore */}
                <tc-add-slot label="Ужина" onClick={() => setAdded((a) => [...a, 'Ужина'])} />
            </div>
            <div style={note}>
                The dashed border is the whole message: in this design a dashed hairline means „not
                a finished object". No fill, no shadow, no icon tile — the slot is the same size and
                shape as the cards it sits among, which is what makes it read as one of them that
                has not happened yet.
            </div>
        </div>
    )
}

// ── Tones, icons, disabled ────────────────────────────────────────────────────

const VariantsExample: React.FC = () => (
    <div>
        <div style={label}>Tones, icons, disabled</div>
        <div style={frame}>
            {/* @ts-ignore */}
            <tc-add-slot label="Состојка" />
            {/* @ts-ignore */}
            <tc-add-slot label="Нова недела" icon="calendar-plus" tone="accent" />
            {/* @ts-ignore */}
            <tc-add-slot label="Достигнат лимит" icon="lock" disabled />
            {/* @ts-ignore */}
            <tc-add-slot
                label="Многу долго име за состојка што нема да се смести во една линија"
                icon="carrot"
            />
        </div>
        <div style={note}>
            <code>tone="accent"</code> is for a slot that <em>is</em> its section's primary action
            because the section is otherwise empty — leaf green, not the amber CTA colour, which is
            unreadable as 12.5px text on cream and is budgeted at two elements per screen. A label
            too long for the slot ellipsises rather than wrapping, which would make the slot taller
            than the card it stands in for. <code>disabled</code> is forwarded to the real{' '}
            <code>&lt;button&gt;</code>, so the platform takes it out of the tab order too.
        </div>
    </div>
)

// ── In a row rather than a column ─────────────────────────────────────────────

const RowExample: React.FC = () => (
    <div>
        <div style={label}>In a row</div>
        <div style={{ ...frame, flexDirection: 'row', gap: '8px' }}>
            {/* @ts-ignore */}
            <tc-add-slot label="Појадок" icon="sun" style={{ flex: 1 }} />
            {/* @ts-ignore */}
            <tc-add-slot label="Ручек" icon="flame" style={{ flex: 1 }} />
            {/* @ts-ignore */}
            <tc-add-slot label="Вечера" icon="layers" style={{ flex: 1 }} />
        </div>
        <div style={note}>
            The host is only the track the slot occupies — the dashed frame is on the{' '}
            <code>&lt;button&gt;</code>, which is also the hit target, so a tap on the border cannot
            land on nothing. In a row the host is content-sized like any flex item; give it{' '}
            <code>flex: 1</code> to spread three slots evenly, as here.
        </div>
    </div>
)

const AddSlotDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <CanvasExample />
        <VariantsExample />
        <RowExample />
    </div>
)

export default AddSlotDemo
