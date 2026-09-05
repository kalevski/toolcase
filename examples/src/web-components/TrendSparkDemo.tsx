import React, { useState } from 'react'
import type { TrendSparkTone } from '@toolcase/web-components'

// Screen `1i` („Исхрана — цели и мерки") of the JADI.mk phone design, at the width it
// was composed: 390px.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '14px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

const card: React.CSSProperties = {
    padding: '14px',
    background: 'var(--tc-surface)',
    border: '1px solid #e5e2dc',
    borderRadius: '10px',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const cardHead: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: '12px',
}

const eyebrow: React.CSSProperties = {
    font: 'var(--m-font-eyebrow)',
    letterSpacing: 'var(--m-track-eyebrow)',
    textTransform: 'uppercase',
    color: '#a4472f',
}

// The design's own polyline, read back out of its y coordinates: 1i draws
// „−2.4 кг од почеток" ending at 68.0 кг, so the series runs 70.4 → 68.0.
const WEIGHT = [70.4, 70.0, 70.1, 69.4, 69.0, 69.1, 68.3, 68.0]

// ── 1i: the weight card ───────────────────────────────────────────────────────

const WeightExample: React.FC = () => (
    <div>
        <div style={label}>1i — тежина</div>
        <div style={phone}>
            <div style={card}>
                <div style={cardHead}>
                    <div style={eyebrow}>Тежина</div>
                    <div
                        style={{
                            font: '400 11.5px var(--m-body)',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#5f8a2e',
                        }}
                    >
                        −2.4 кг од почеток
                    </div>
                </div>
                <tc-trend-spark
                    points={WEIGHT.join(',')}
                    spoken="тежина: од 70.4 на 68.0 килограми во осум мерења"
                >
                    <span slot="caption-start">1 мај</span>
                    <span slot="caption-end">денес · 68.0 кг</span>
                </tc-trend-spark>
            </div>
        </div>
        <div style={note}>
            Terracotta line at 2.2px, a 9%-alpha area under it, a 4px dot at „now", and the two
            captions at opposite ends of one row. Not a chart: no axes, no gridlines, no tooltips.
            The captions are the CONSUMER's children — the element never re-parents them, so it lays
            them out with a two-track grid instead of wrapping them in a flex row.
        </div>
    </div>
)

// ── The widths it has to survive ──────────────────────────────────────────────

const WIDTHS = [430, 390, 375, 320]

const FluidExample: React.FC = () => (
    <div>
        <div style={label}>320 → 430px, no distortion</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {WIDTHS.map((w) => (
                <div key={w} style={{ ...phone, width: `${w}px` }}>
                    <div style={card}>
                        <tc-trend-spark points={WEIGHT.join(',')}>
                            <span slot="caption-start">{w}px</span>
                            <span slot="caption-end">68.0 кг</span>
                        </tc-trend-spark>
                    </div>
                </div>
            ))}
        </div>
        <div style={note}>
            `preserveAspectRatio="none"`, so the 330×72 viewBox fills whatever width the card gives
            it rather than letterboxing at 0.8 scale. The line and the dot carry
            `vector-effect="non-scaling-stroke"` so neither squashes with it — measure the stroke at
            320px and at 430px and it is 2.2px both times. The dot is a zero-length path with a
            round cap, not a &lt;circle&gt;: a circle under a released aspect ratio comes out as a
            3.2×4 ellipse.
        </div>
    </div>
)

// ── The series that break a naive implementation ──────────────────────────────

const SERIES: Array<{ name: string; points: number[]; min?: number; max?: number; why: string }> = [
    {
        name: 'flat',
        points: [68, 68, 68, 68, 68, 68],
        why: 'zero range — drawn through the middle of the band, not pinned to the top',
    },
    {
        name: 'flat, clamped',
        points: [68, 68, 68, 68],
        min: 60,
        max: 80,
        why: 'same series inside an authored domain',
    },
    {
        name: 'noise',
        points: [68.0, 67.9, 68.0, 67.9],
        why: 'a 0.1kg wobble fills the band edge to edge',
    },
    {
        name: 'noise, clamped',
        points: [68.0, 67.9, 68.0, 67.9],
        min: 65,
        max: 71,
        why: 'the same wobble against a 6kg domain — what it actually is',
    },
    { name: 'rising', points: [64, 65.2, 66, 67.4, 68, 69.1], why: '' },
    { name: 'two points', points: [70, 68], why: '' },
    { name: 'one point', points: [68], why: 'no line to draw — just the dot at „now"' },
    {
        name: 'empty',
        points: [],
        why: 'an empty box, so the panel does not collapse while the first measurement saves',
    },
]

const EdgeExample: React.FC = () => (
    <div>
        <div style={label}>Series that break a naive sparkline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {SERIES.map((s) => (
                <div key={s.name} style={{ ...phone, padding: '10px 14px' }}>
                    <tc-trend-spark points={s.points.join(',')} min={s.min} max={s.max}>
                        <span slot="caption-start">{s.name}</span>
                        <span slot="caption-end">{s.why}</span>
                    </tc-trend-spark>
                </div>
            ))}
        </div>
    </div>
)

const ToneExample: React.FC = () => {
    const [tone, setTone] = useState<TrendSparkTone>('accent')
    const tones: TrendSparkTone[] = ['accent', 'lead', 'success', 'info', 'danger', 'ink']

    return (
        <div>
            <div style={label}>tone · no-fill · no-dot</div>
            <div style={{ ...phone, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <tc-trend-spark points={WEIGHT.join(',')} tone={tone} />
                <tc-trend-spark points={WEIGHT.join(',')} tone={tone} no-fill />
                <tc-trend-spark points={WEIGHT.join(',')} tone={tone} no-dot />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {tones.map((v) => (
                    <button
                        key={v}
                        className={`btn btn-sm ${tone === v ? 'btn-primary' : 'btn-outline-secondary'}`}
                        type="button"
                        onClick={() => setTone(v)}
                    >
                        {v}
                    </button>
                ))}
            </div>
            <div style={note}>
                One hue drives the line, the fill and the dot — the fill is `color-mix(in srgb, tone
                9%, transparent)`, which IS the hue at alpha .09, so it is bit-exact against the
                design's `rgba(164,71,47,.09)` and still one value away from a re-skin. `no-fill` /
                `no-dot` are negated because a boolean attribute cannot default to true.
            </div>
        </div>
    )
}

const TrendSparkDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <WeightExample />
        <FluidExample />
        <EdgeExample />
        <ToneExample />
    </div>
)

export default TrendSparkDemo
