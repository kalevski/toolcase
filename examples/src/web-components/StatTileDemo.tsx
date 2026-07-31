import React, { useEffect, useRef, useState } from 'react'

// Screens `1k` („Нутриционист") and `1i` („Исхрана") of the JADI.mk phone design, at
// the width they were composed: 390px.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '14px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

// The card the tiles sit inside on 1i — #fffdf7 at 10px radius.
const card: React.CSSProperties = {
    padding: '14px',
    background: 'var(--tc-surface)',
    border: '1px solid #e5e2dc',
    borderRadius: '10px',
    boxShadow: 'var(--m-bevel-top)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const eyebrow: React.CSSProperties = {
    font: 'var(--m-font-eyebrow)',
    letterSpacing: 'var(--m-track-eyebrow)',
    textTransform: 'uppercase',
    color: '#a4472f',
    marginBottom: '11px',
}

const row3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'var(--m-gap-grid)',
}

// ── 1k: the three server-computed stats ───────────────────────────────────────

const ProfileExample: React.FC = () => (
    <div>
        <div style={label}>1k — три сервер-пресметани бројки</div>
        <div style={phone}>
            <div style={row3}>
                {/* Amber, and the only amber on this screen besides the primary
                    action — hence `lead` rather than `accent`. */}
                <tc-stat-tile
                    value="4.8"
                    label="37 оцени"
                    tone="lead"
                    spoken="4.8 од 5, 37 оцени"
                />
                <tc-stat-tile value="62" label="соработки" spoken="62 соработки" />
                <tc-stat-tile value="4 ч" label="одговара за" spoken="одговара за 4 часа" />
            </div>
        </div>
        <div style={note}>
            The `card` variant, verbatim from 1k: #fffdf7 on a 1px #e5e2dc border at 10px radius,
            11px padding, centred. `spoken` is what a screen reader announces instead of the glyphs
            — „4 ч" would otherwise be read as two letters.
        </div>
    </div>
)

// ── 1i: the big figure, and the tinted inner tiles ────────────────────────────

const TargetExample: React.FC = () => (
    <div>
        <div style={label}>1i — дневна цел + макроа</div>
        <div style={phone}>
            <div style={card}>
                <div style={eyebrow}>Пресметани цели</div>
                <tc-stat-tile
                    variant="bare"
                    size="lg"
                    align="start"
                    value="1 900"
                    unit="ккал / ден"
                    spoken="1 900 килокалории на ден"
                />
                <div style={{ ...row3, marginTop: '12px' }}>
                    {/* The per-macro hues are DATA — they belong to the app, so they
                        come in through `color` rather than through a tone. */}
                    <tc-stat-tile
                        variant="well"
                        size="sm"
                        align="start"
                        value="128 г"
                        label="белковини"
                        color="#4e6b3c"
                    />
                    <tc-stat-tile
                        variant="well"
                        size="sm"
                        align="start"
                        value="63 г"
                        label="масти"
                        color="#8a6d2f"
                    />
                    <tc-stat-tile
                        variant="well"
                        size="sm"
                        align="start"
                        value="213 г"
                        label="јаглехидрати"
                        color="#3c5d6b"
                    />
                </div>
            </div>
        </div>
        <div style={note}>
            Three variants, one structure: `bare` drops the box entirely (the 38px figure sits
            straight on the card), `well` is the #f4f1ea inner tile at 8px radius. Both are
            `align="start"` — only 1d and 1k centre their tiles.
        </div>
    </div>
)

// ── tabular-nums, proved ──────────────────────────────────────────────────────

const JitterExample: React.FC = () => {
    const [n, setN] = useState(9)
    const [running, setRunning] = useState(false)
    // Captured on the first frame of the run and compared on the last: if any figure
    // were proportional, the label under it would move.
    const probe = useRef<HTMLDivElement>(null)
    const [shift, setShift] = useState<string>('—')

    useEffect(() => {
        if (!running) return
        const start = probe.current?.getBoundingClientRect().left ?? 0
        const timer = setInterval(() => {
            setN((v) => {
                if (v >= 1000) {
                    setRunning(false)
                    const end = probe.current?.getBoundingClientRect().left ?? 0
                    setShift(`${(end - start).toFixed(2)}px`)
                    return 1000
                }
                // Roughly ×1.35 per tick, so 9 → 1000 crosses every digit count.
                return Math.min(1000, Math.ceil(v * 1.35))
            })
        }, 90)
        return () => clearInterval(timer)
    }, [running])

    return (
        <div>
            <div style={label}>tabular-nums — 9 → 1000 without a reflow</div>
            <div style={phone}>
                <div style={card}>
                    <div style={row3}>
                        <tc-stat-tile value={String(n)} label="ккал" tone="accent" />
                        <tc-stat-tile value={String(n)} label="белк. г" />
                        <div ref={probe}>
                            <tc-stat-tile value={String(n)} label="масти г" />
                        </div>
                    </div>
                </div>
            </div>
            <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => {
                    setShift('—')
                    setN(9)
                    setRunning(true)
                }}
                disabled={running}
            >
                {running ? `${n}…` : 'Run 9 → 1000'}
            </button>
            <div style={note}>
                Third cell's left edge moved: <strong>{shift}</strong>. Tabular figures are what
                make that 0 — 1d's four numbers are driven by the serving scaler and change on every
                tap of the stepper. The `font` shorthand RESETS `font-variant-numeric`, so the
                partial declares it after the shorthand; reverse the two and this reads ~2px.
            </div>
        </div>
    )
}

// ── The rest of the surface ───────────────────────────────────────────────────

const VariantsExample: React.FC = () => (
    <div>
        <div style={label}>Tones, sizes, hint, trailing</div>
        <div style={phone}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '9px' }}>
                <tc-stat-tile value="1 284" label="корисници" hint="+8 во последните 30 дена" />
                <tc-stat-tile value="98%" label="достапност" tone="success" />
                <tc-stat-tile value="27" label="чекаат одобрување" tone="warning" />
                <tc-stat-tile value="3" label="пријави" tone="danger" />
                <tc-stat-tile value="12" label="нутриционисти" tone="info" />
                <tc-stat-tile value="486" label="ккал" tone="accent" align="start">
                    <span slot="trailing" aria-hidden="true">
                        ↗
                    </span>
                </tc-stat-tile>
            </div>
        </div>
        <div style={note}>
            `hint` is the admin overview's third line. `[slot="trailing"]` stays a child of the host
            — the element never re-parents it, so a conditionally-rendered delta chip cannot go
            stale under react-dom.
        </div>
    </div>
)

const StatTileDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <ProfileExample />
        <TargetExample />
        <JitterExample />
        <VariantsExample />
    </div>
)

export default StatTileDemo
