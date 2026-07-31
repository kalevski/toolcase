import React, { useState } from 'react'

// Screens `1d` („Рецепт") and `1i` („Исхрана") of the JADI.mk phone design, at the
// width they were composed: 390px.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '15px 16px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

const card: React.CSSProperties = {
    padding: '13px 14px',
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

const cardHead: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '11px',
}

const eyebrow: React.CSSProperties = {
    font: 'var(--m-font-eyebrow)',
    letterSpacing: 'var(--m-track-eyebrow)',
    textTransform: 'uppercase',
    color: '#a4472f',
}

// 1d's own numbers, per serving, and the same numbers scaled by the stepper.
const PER_SERVING = { kcal: 486, prot: 21, carb: 62, fat: 14 }
const BASE_SERVINGS = 4

// ── 1d: the 4-up per-serving row, live under the serving scaler ───────────────

const NutritionExample: React.FC = () => {
    const [servings, setServings] = useState(BASE_SERVINGS)
    const scale = servings / BASE_SERVINGS
    const at = (v: number): string => String(Math.round(v * scale))

    return (
        <div>
            <div style={label}>1d — по порција, под скалерот</div>
            <div style={phone}>
                <div style={card}>
                    <div style={cardHead}>
                        <div style={eyebrow}>По порција</div>
                        <div
                            style={{ font: 'var(--m-font-btn-sm)', color: 'var(--tc-text-faint)' }}
                        >
                            процена
                        </div>
                    </div>
                    <tc-macro-grid columns="4" variant="bare">
                        <tc-stat-tile value={at(PER_SERVING.kcal)} label="ккал" tone="accent" />
                        <tc-stat-tile value={at(PER_SERVING.prot)} label="белк. г" />
                        <tc-stat-tile value={at(PER_SERVING.carb)} label="јагл. г" />
                        <tc-stat-tile value={at(PER_SERVING.fat)} label="масти г" />
                        <div slot="footer">
                            <span>Проценето од 8 од 11 состојки</span>
                            <span style={{ font: 'var(--m-font-meta-strong)', color: '#5f8a2e' }}>
                                Целосно ⌄
                            </span>
                        </div>
                    </tc-macro-grid>
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '14px',
                    }}
                >
                    <span style={{ font: 'var(--m-font-label)', flex: '1 1 0' }}>Порции</span>
                    <button
                        className="btn btn-outline-secondary btn-sm"
                        type="button"
                        onClick={() => setServings((v) => Math.max(1, v - 1))}
                    >
                        −
                    </button>
                    <span
                        style={{
                            minWidth: '22px',
                            textAlign: 'center',
                            font: '700 19px var(--m-body)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {servings}
                    </span>
                    <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={() => setServings((v) => Math.min(24, v + 1))}
                    >
                        +
                    </button>
                </div>
            </div>
            <div style={note}>
                `variant="bare"` at 4 columns: 8px column gap, no box on the cells, 9.5px labels,
                the first figure accent-coloured. The dashed footer is the `footer` slot — an 11px
                row gap above it and a 10px pad below the rule, which is 1d verbatim. Drive the
                stepper: the four columns do not move.
            </div>
        </div>
    )
}

// ── 1i: the three tinted macro tiles ──────────────────────────────────────────

const TargetsExample: React.FC = () => (
    <div>
        <div style={label}>1i — макро цели</div>
        <div style={phone}>
            <div style={{ ...card, padding: '14px' }}>
                <div style={{ ...eyebrow, marginBottom: '11px' }}>Пресметани цели</div>
                <tc-stat-tile
                    variant="bare"
                    size="lg"
                    align="start"
                    value="1 900"
                    unit="ккал / ден"
                    spoken="1 900 килокалории на ден"
                />
                <div style={{ height: '12px' }} />
                <tc-macro-grid columns="3" variant="tiled">
                    <tc-stat-tile value="128 г" label="белковини" color="#4e6b3c" />
                    <tc-stat-tile value="63 г" label="масти" color="#8a6d2f" />
                    <tc-stat-tile value="213 г" label="јаглехидрати" color="#3c5d6b" />
                    <div slot="footer">
                        <span
                            style={{
                                font: 'var(--m-font-chip-lg)',
                                fontWeight: 600,
                                color: '#5f8a2e',
                            }}
                        >
                            Како ја пресметуваме целта
                        </span>
                        <span aria-hidden="true" style={{ color: '#5f8a2e' }}>
                            ⌄
                        </span>
                    </div>
                </tc-macro-grid>
            </div>
        </div>
        <div style={note}>
            `variant="tiled"` at 3 columns: each cell becomes the #f4f1ea well at 8px radius, 9px
            10px padding, a 16px figure, left-aligned. The tiles carry no `variant` of their own —
            the ROW's variant wins, deliberately, because the design has no row of mismatched tiles.
        </div>
    </div>
)

// ── Where it breaks, and where it does not ────────────────────────────────────

const NarrowExample: React.FC = () => (
    <div>
        <div style={label}>320px — the narrowest phone still in service</div>
        <div style={{ ...phone, width: '320px', padding: '12px 14px' }}>
            <div style={card}>
                <tc-macro-grid columns="4" variant="bare">
                    <tc-stat-tile value="1 486" label="ккал" tone="accent" />
                    <tc-stat-tile value="21" label="белк. г" />
                    <tc-stat-tile value="62" label="јагл. г" />
                    <tc-stat-tile value="14" label="масти г" />
                </tc-macro-grid>
            </div>
        </div>
        <div style={note}>
            60px per cell at 320px. „1 486" fits at 20px/700 tabular; a fifth column would not,
            which is why `columns` stops at 4 rather than being open-ended.
        </div>
    </div>
)

const MacroGridDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <NutritionExample />
        <TargetsExample />
        <NarrowExample />
    </div>
)

export default MacroGridDemo
