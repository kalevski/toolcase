import React, { useEffect, useRef, useState } from 'react'

function useSliderValue(initial: number): [number, React.RefObject<any>] {
    const [value, setValue] = useState<number>(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (typeof detail?.value === 'number') setValue(detail.value as number)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return [value, ref]
}

const SliderDemo: React.FC = () => {
    const [v1, ref1] = useSliderValue(50)
    const [v2, ref2] = useSliderValue(0)
    const [v3, ref3] = useSliderValue(60)

    // formatValue is a function → must be set on the element via a ref.
    const fmtRef = useRef<any>(null)
    useEffect(() => {
        const el = fmtRef.current
        if (el) el.formatValue = (n: number) => `$${n.toFixed(2)}`
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Slider"
                            description="Single-handle range slider with keyboard support, optional ticks, tooltip, custom value formatting, and error handling."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — live value">
                                <div style={{ maxWidth: 460, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-slider
                                        ref={ref1}
                                        label="Volume"
                                        min="0"
                                        max="100"
                                        value="50"
                                        show-tooltip
                                    />
                                    <div className="form-text mt-1">Current value: {v1}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Ticks (−20 → 40, step 5)">
                                <div style={{ maxWidth: 460, padding: '8px 0 24px' }}>
                                    {/* @ts-ignore */}
                                    <tc-slider
                                        ref={ref2}
                                        label="Temperature (°C)"
                                        min="-20"
                                        max="40"
                                        step="5"
                                        value="0"
                                        ticks
                                        show-tooltip
                                    />
                                    <div className="form-text mt-1">Current value: {v2}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom formatValue (currency)">
                                <div style={{ maxWidth: 460, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-slider
                                        ref={fmtRef}
                                        label="Budget"
                                        min="0"
                                        max="500"
                                        step="10"
                                        value="120"
                                        show-tooltip
                                    />
                                    <div className="form-text mt-1">
                                        Drag or focus the thumb — the tooltip shows the formatted
                                        value.
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Error state">
                                <div style={{ maxWidth: 460, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-slider
                                        ref={ref3}
                                        label="Allocation (%)"
                                        min="0"
                                        max="100"
                                        value="60"
                                        show-tooltip
                                        error="Allocation exceeds the recommended limit."
                                    />
                                    <div className="form-text mt-1">Current value: {v3}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div style={{ maxWidth: 460, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-slider
                                        label="Disabled slider"
                                        min="0"
                                        max="100"
                                        value="40"
                                        disabled
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SliderDemo
