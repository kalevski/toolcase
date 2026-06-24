import React, { useEffect, useRef, useState } from 'react'

function useRangeSliderValue(initial: [number, number]): [[number, number], React.RefObject<any>] {
    const [value, setValue] = useState<[number, number]>(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.value = initial
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail?.value) setValue(detail.value as [number, number])
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return [value, ref]
}

const RangeSliderDemo: React.FC = () => {
    const [v1, ref1] = useRangeSliderValue([20, 80])
    const [v2, ref2] = useRangeSliderValue([0, 50])
    const [v3, ref3] = useRangeSliderValue([2, 7])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Range Slider"
                            description="Dual-handle range slider with optional ticks, tooltips, and full keyboard navigation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — ticks + tooltips">
                                <div style={{ maxWidth: 500, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-range-slider
                                        ref={ref1}
                                        label="Price range ($)"
                                        min="0"
                                        max="100"
                                        step="5"
                                        ticks
                                        show-tooltip
                                    />
                                    <div className="form-text mt-1">
                                        Selected: ${v1[0]} – ${v1[1]}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No ticks, no tooltip">
                                <div style={{ maxWidth: 500, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-range-slider
                                        ref={ref2}
                                        label="Volume range"
                                        min="0"
                                        max="100"
                                    />
                                    <div className="form-text mt-1">
                                        Selected: {v2[0]} – {v2[1]}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom step (1–10)">
                                <div style={{ maxWidth: 500, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-range-slider
                                        ref={ref3}
                                        label="Rating range"
                                        min="1"
                                        max="10"
                                        step="1"
                                        show-tooltip
                                    />
                                    <div className="form-text mt-1">
                                        Selected: {v3[0]} – {v3[1]}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div style={{ maxWidth: 500, padding: '8px 0 20px' }}>
                                    {/* @ts-ignore */}
                                    <tc-range-slider
                                        label="Disabled slider"
                                        min="0"
                                        max="100"
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

export default RangeSliderDemo
