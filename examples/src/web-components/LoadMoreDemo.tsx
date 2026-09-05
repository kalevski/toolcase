import React, { useCallback, useRef, useState } from 'react'

// tc-load-more is the phone's replacement for a numbered pager: it APPENDS the next
// page in place instead of replacing the list, so the reader keeps their scroll
// position. 390px is the width the JADI.mk canvas was composed at.

const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '14px',
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
    maxWidth: '62ch',
}

const row: React.CSSProperties = {
    padding: '13px 4px',
    borderBottom: '1px dashed var(--m-rule-dashed, var(--tc-border))',
    font: '600 14.5px var(--m-body, inherit)',
    color: 'var(--tc-text)',
}

const PAGE = 6
const TOTAL = 20

const RECIPES = [
    'Тавче гравче',
    'Ајвар од печени пиперки',
    'Селска салата',
    'Полнети пиперки',
    'Мусака со тиквички',
    'Питулици',
    'Пастрмајлија',
    'Турли тава',
    'Зелник со спанаќ',
    'Гравче на тавче со кобасица',
    'Шопска салата',
    'Малиденска чорба',
    'Погача со сол',
    'Ѓомлезе',
    'Локум',
    'Баклава',
    'Тулумби',
    'Компир мунja',
    'Сарма од кисела зелка',
    'Проја',
]

// ── The whole loop ────────────────────────────────────────────────────────────

const LiveExample: React.FC = () => {
    const [shown, setShown] = useState(PAGE)
    const [loading, setLoading] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const load = useCallback(() => {
        setLoading(true)
        // A real fetch. The 600ms is what makes the `loading` state worth having —
        // instant appends never show it, and a state nobody sees is a state nobody
        // maintains.
        timer.current = setTimeout(() => {
            setShown((n) => Math.min(TOTAL, n + PAGE))
            setLoading(false)
        }, 600)
    }, [])

    const exhausted = shown >= TOTAL
    const remaining = TOTAL - shown
    const state = loading ? 'loading' : exhausted ? 'exhausted' : 'idle'

    return (
        <div>
            <div style={label}>Idle → loading → exhausted, driven by a real append</div>
            <div style={phone}>
                {RECIPES.slice(0, shown).map((name) => (
                    <div key={name} style={row}>
                        {name}
                    </div>
                ))}
                <tc-load-more
                    state={state}
                    label="Прикажи повеќе"
                    loading-label="Се вчитува…"
                    exhausted-label="Го видовте целиот тефтер"
                    count={remaining > 0 ? `+${Math.min(PAGE, remaining)}` : undefined}
                    ontc-load-more={load}
                />
            </div>
            <div style={note}>
                <code>ontc-load-more</code> fires once per tap and never while loading — the element
                guards its own state, so a slow connection cannot stack requests. The count is „how
                many the next tap brings", not a total: it answers „is this worth a tap" without
                bringing the pager's arithmetic back.
            </div>
        </div>
    )
}

// ── The three states, side by side ────────────────────────────────────────────

const States: React.FC = () => (
    <div>
        <div style={label}>The three states</div>
        <div style={{ ...phone, gap: '18px' }}>
            <tc-load-more label="Прикажи повеќе" count="+20" />
            <tc-load-more state="loading" loading-label="Се вчитува…" />
            <tc-load-more state="exhausted" exhausted-label="Го видовте целиот тефтер" />
        </div>
        <div style={note}>
            The terminal state is not a hidden element. A list that simply stops has told nobody
            that it finished, so the reader keeps flicking at the bottom to check — this states the
            ending once, quietly, and occupies real height on purpose.
        </div>
    </div>
)

const LoadMoreDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <LiveExample />
        <States />
    </div>
)

export default LoadMoreDemo
