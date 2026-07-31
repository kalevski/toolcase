import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

// Screens `1h` („Листа"), `1j` („Планер") and `1b` („Дома") of the JADI.mk phone
// design, at the width they were composed: 390px.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '12px 14px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

// Verbatim from the design file's own DCLogic script — including the empty amount on
// „Сол", which is what the `—` fallback below is for.
const ITEMS = [
    { name: 'Тетовски грав', amount: '500 г', hint: 'во фрижидер: 120 г', done: true },
    { name: 'Кромид', amount: '3 главици', hint: '', done: true },
    { name: 'Црвен пипер', amount: '1.5 суп. лажица', hint: '⇄ Слатка алева (1:1)', done: true },
    { name: 'Сончогледово масло', amount: '1.2 л', hint: '', done: false },
    { name: 'Домати', amount: '800 г', hint: 'во фрижидер: 350 г', done: false },
    { name: 'Сол', amount: '', hint: 'без мерка', done: false },
    { name: 'Ќесиња за ѓубре', amount: '1 пакет', hint: 'рачно додадено', done: false },
]

// ── 1h: the shopping list, seven rows, three pre-ticked ───────────────────────

const ShoppingExample: React.FC = () => {
    const [done, setDone] = useState<boolean[]>(ITEMS.map((i) => i.done))
    const [log, setLog] = useState('—')

    // ONE listener on the container, not seven on the rows: `tc-check-row-change`
    // bubbles and composes, so a list delegates. The detail's `name` is what keys the
    // update — which is also exactly what an offline queue would key on.
    const list = useTcEvents<HTMLDivElement>({
        'tc-check-row-change': (e: CustomEvent) => {
            const idx = Number(e.detail.name)
            setDone((prev) => prev.map((v, i) => (i === idx ? e.detail.checked : v)))
            setLog(`${ITEMS[idx].name} → ${e.detail.checked ? 'купено' : 'останува'}`)
        },
    })

    const bought = done.filter(Boolean).length

    return (
        <div>
            <div style={label}>
                1h — тick-off list · {bought} од {ITEMS.length} купено
            </div>
            <div style={phone}>
                {/* The design's own progress track above the list. */}
                <div
                    style={{
                        height: '6px',
                        borderRadius: '999px',
                        background: 'var(--sun-well, var(--tc-surface-muted))',
                        overflow: 'hidden',
                        marginBottom: '12px',
                    }}
                >
                    <div
                        style={{
                            width: `${Math.round((bought / ITEMS.length) * 100)}%`,
                            height: '100%',
                            background: 'var(--tc-app-accent)',
                            transition: 'width .18s cubic-bezier(.2,.9,.25,1)',
                        }}
                    />
                </div>
                <div ref={list}>
                    {ITEMS.map((item, i) => (
                        <tc-check-row
                            key={item.name}
                            name={String(i)}
                            label={item.name}
                            hint={item.hint || (done[i] ? 'купено' : 'останува')}
                            trailing={item.amount || '—'}
                            checked={done[i] || undefined}
                        />
                    ))}
                </div>
            </div>
            <div style={note}>last change: {log}</div>
        </div>
    )
}

// ── 1j: the meal done-toggle — a 30px circle, green, no strike, no dim ────────

const MealExample: React.FC = () => (
    <div>
        <div style={label}>1j — meal toggle · shape="circle" tone="success" no-strike no-dim</div>
        <div style={phone}>
            <tc-list-section
                heading="Ручек"
                icon="flame"
                meta="628 ккал"
                style={{ '--bs-list-section-tone': '#a4472f' } as React.CSSProperties}
            >
                <tc-check-row
                    shape="circle"
                    tone="success"
                    no-strike
                    no-dim
                    label="Тавче гравче"
                    hint="1 порција · 486 ккал"
                    style={
                        {
                            '--bs-check-row-label-font': '600 14px var(--m-body)',
                        } as React.CSSProperties
                    }
                />
                <tc-check-row
                    shape="circle"
                    tone="success"
                    no-strike
                    no-dim
                    label="Шопска салата"
                    hint="1 порција · 142 ккал"
                    style={
                        {
                            '--bs-check-row-label-font': '600 14px var(--m-body)',
                        } as React.CSSProperties
                    }
                />
            </tc-list-section>
        </div>
        <div style={note}>
            Inside a tc-list-section the group owns row rhythm: the rows take its 11px 12px padding
            and drop their own divider, so the last row has no hairline against the frame.
        </div>
    </div>
)

// ── 1b: the onboarding checklist — a 22px circle, completed and disabled ──────

const OnboardingExample: React.FC = () => (
    <div>
        <div style={label}>1b — onboarding ticks · 22px circle via --bs-check-row-box-size</div>
        <div style={{ ...phone, background: 'var(--sun-surface, var(--tc-surface))' }}>
            {[
                { label: 'Создајте рецепт', done: true },
                { label: 'Направете план за исхрана', done: true },
                { label: 'Направете листа за пазар', done: false },
            ].map((step) => (
                <tc-check-row
                    key={step.label}
                    shape="circle"
                    tone="success"
                    divider="none"
                    label={step.label}
                    checked={step.done || undefined}
                    disabled={step.done || undefined}
                    style={
                        {
                            // 1b's ticks are 22px with a 12px glyph, and its rows are a
                            // 9px-gapped stack with no padding — a STATUS list, not a
                            // control: a step is completed by doing the thing.
                            '--bs-check-row-box-size': 'var(--m-size-check-sm)',
                            '--bs-check-row-tick-size': '12px',
                            '--bs-check-row-gap': '10px',
                            '--bs-check-row-padding': '4px 0',
                            '--bs-check-row-min-height': '30px',
                            '--bs-check-row-align': 'center',
                            '--bs-check-row-box-offset': '0',
                            '--bs-check-row-label-font': '600 13px var(--m-body)',
                        } as React.CSSProperties
                    }
                />
            ))}
        </div>
        <div style={note}>
            The completed steps are `disabled`, which is deliberately not dimmed —
            `--bs-check-row-disabled-opacity` defaults to 1, because the row already spends opacity
            on „done" and a checked+disabled row would otherwise multiply the two.
        </div>
    </div>
)

// ── Variants and states ───────────────────────────────────────────────────────

const VariantsExample: React.FC = () => (
    <div>
        <div style={label}>Variants</div>
        <div style={phone}>
            <tc-check-row label="Square · accent (default)" trailing="500 г" />
            <tc-check-row shape="circle" label="Circle · accent" trailing="3 главици" />
            <tc-check-row tone="success" label="Square · success" trailing="1.2 л" />
            <tc-check-row shape="circle" tone="success" label="Circle · success" trailing="800 г" />
            <tc-check-row
                checked
                label="Checked · struck and dimmed"
                hint="купено"
                trailing="1 пакет"
            />
            <tc-check-row checked no-strike label="Checked · no-strike" trailing="—" />
            <tc-check-row checked no-dim label="Checked · no-dim" trailing="—" />
            <tc-check-row divider="solid" label="divider=solid" trailing="—" />
            <tc-check-row divider="none" label="divider=none" trailing="—" />
            <tc-check-row disabled label="Disabled" hint="не може да се штиклира" />
            <tc-check-row label="Со slotted контрола" hint="копчето не штиклира" trailing="800 г">
                <button slot="trailing" className="btn btn-sm btn-outline-secondary" type="button">
                    Смени
                </button>
            </tc-check-row>
        </div>
        <div style={note}>
            Tab into the list: the ring is drawn on the whole row, because the whole row is what a
            press hits. Space toggles. The slotted button sits outside the &lt;label&gt;, so
            pressing it does not tick the row.
        </div>
    </div>
)

// ── Form participation ────────────────────────────────────────────────────────

const FormExample: React.FC = () => {
    const [submitted, setSubmitted] = useState('—')
    return (
        <div>
            <div style={label}>Native form participation</div>
            <form
                style={phone}
                onSubmit={(e) => {
                    e.preventDefault()
                    const data = new FormData(e.currentTarget)
                    setSubmitted(data.getAll('bought').join(', ') || '(none)')
                }}
            >
                <tc-check-row
                    name="bought"
                    value="grav"
                    label="Тетовски грав"
                    trailing="500 г"
                    checked
                />
                <tc-check-row name="bought" value="kromid" label="Кромид" trailing="3 главици" />
                <tc-check-row name="bought" value="domati" label="Домати" trailing="800 г" />
                <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    style={{ marginTop: '12px' }}
                >
                    Submit
                </button>
            </form>
            <div style={note}>
                No ElementInternals and no form-associated custom element: the row renders a real
                &lt;input type="checkbox"&gt; in the light DOM, so the platform collects it. bought
                = {submitted}
            </div>
        </div>
    )
}

const CheckRowDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <ShoppingExample />
        <MealExample />
        <OnboardingExample />
        <VariantsExample />
        <FormExample />
    </div>
)

export default CheckRowDemo
