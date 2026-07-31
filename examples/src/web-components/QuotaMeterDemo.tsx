import React, { useState } from 'react'

// Screens `1c` („Рецепти") and `1h` („Листа") of the JADI.mk phone design, at the width
// they were composed: 390px.
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

const countRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
}

// ── 1c: the inline meter beside the recipe count ──────────────────────────────

const CookbookExample: React.FC = () => {
    const [used, setUsed] = useState(12)

    return (
        <div>
            <div style={label}>1c — квота на рецепти</div>
            <div style={phone}>
                <div style={countRow}>
                    <span style={{ font: '400 11.5px var(--m-body)', color: '#998f80' }}>
                        {used} рецепти
                    </span>
                    <tc-quota-meter used={used} total={30} spoken="искористени рецепти" />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {[0, 12, 26, 27, 29, 30, 32].map((n) => (
                    <button
                        key={n}
                        className={`btn btn-sm ${used === n ? 'btn-primary' : 'btn-outline-secondary'}`}
                        type="button"
                        onClick={() => setUsed(n)}
                    >
                        {n}/30
                    </button>
                ))}
            </div>
            <div style={note}>
                78×5 track, amber fill, „12/30" at 600 11px — 1c verbatim. At 27/30 (90%) the fill
                turns ochre #d49a00 and at 30/30 coral #f2604b; 32/30 stays coral with the fill
                clamped at 100% while the figure keeps reporting the truth. Colour is never the only
                carrier — the fraction says the same thing, and the track is a `role="progressbar"`
                reporting 27 of 30.
            </div>
        </div>
    )
}

// ── warn-at: the app's own „last slot" rule ───────────────────────────────────

const WarnAtExample: React.FC = () => (
    <div>
        <div style={label}>warn-at — a different rule about „nearly out"</div>
        <div style={{ ...phone, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <tc-quota-meter
                used={2}
                total={3}
                width="120"
                suffix="планови"
                spoken="искористени планови"
            />
            <tc-quota-meter
                used={2}
                total={3}
                width="120"
                warn-at={(2 / 3) * 100}
                suffix="планови"
                spoken="искористени планови"
            />
        </div>
        <div style={note}>
            Both are 2 of 3 = 66.7%. The first is `ok` under the default 90% rule; the second passes{' '}
            <code>{'warn-at={(limit - 1) / limit * 100}'}</code>, which is the app's LimitMeter rule
            — „warn on the last slot" — expressed as a percentage instead of re-derived per caller.
        </div>
    </div>
)

// ── 1h: the bar variant, live under a tick-off ────────────────────────────────

const SHOPPING = 7

const ProgressExample: React.FC = () => {
    const [bought, setBought] = useState(3)

    return (
        <div>
            <div style={label}>1h — напредок на список</div>
            <div style={phone}>
                <tc-quota-meter variant="bar" used={bought} total={SHOPPING} />
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                    <button
                        className="btn btn-outline-secondary btn-sm"
                        type="button"
                        onClick={() => setBought((v) => Math.max(0, v - 1))}
                    >
                        −
                    </button>
                    <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => setBought((v) => Math.min(SHOPPING, v + 1))}
                    >
                        + купено ({bought}/{SHOPPING})
                    </button>
                </div>
            </div>
            <div style={note}>
                The `bar` variant: 6px tall, full width, and no figure by default — 1h's app bar
                already carries „N од 7 купено" and a second reading 12px below it would be a
                duplicate. Width animates with <code>width .18s cubic-bezier(.2,.9,.25,1)</code>,
                the one transition the design canvas specifies; foundation/_reset.scss flattens it
                under `prefers-reduced-motion`.
            </div>
        </div>
    )
}

// ── Label formats, tones, and the uncapped case ───────────────────────────────

const FormatsExample: React.FC = () => (
    <div>
        <div style={label}>label-format · suffix · tone · no cap</div>
        <div style={{ ...phone, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <tc-quota-meter used={12} total={30} label-format="fraction" />
            <tc-quota-meter used={12} total={30} label-format="percent" />
            <tc-quota-meter used={12} total={30} label-format="remaining" suffix="останати" />
            <tc-quota-meter used={12} total={30} label-format="none" />
            <tc-quota-meter used={12} total={30} tone="accent" />
            <tc-quota-meter used={12} total={30} tone="success" />
            <tc-quota-meter used={12} total={0} label-format="none" />
        </div>
        <div style={note}>
            The last one has no total: the fill stays empty and every ARIA attribute comes off the
            track, because a `progressbar` with `aria-valuemax="0"` is invalid and reads as „0
            percent" — the opposite of what an uncapped allowance means. Hide the element instead of
            rendering it.
        </div>
    </div>
)

const QuotaMeterDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <CookbookExample />
        <WarnAtExample />
        <ProgressExample />
        <FormatsExample />
    </div>
)

export default QuotaMeterDemo
