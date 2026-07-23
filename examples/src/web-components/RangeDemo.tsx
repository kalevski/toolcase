import React, { useState } from 'react'
import { useTcEvents, type TcRef } from '@toolcase/web-components/react'

function useRangeValue(initial: string): [string, TcRef<HTMLElement>] {
    const [value, setValue] = useState(initial)
    const ref = useTcEvents<HTMLElement>({
        input: (e: Event) => {
            const input = e.target as HTMLInputElement
            if (input.tagName === 'INPUT') setValue(input.value)
        },
    })

    return [value, ref]
}

const RangeDemo: React.FC = () => {
    const [v1, ref1] = useRangeValue('50')
    const [v2, ref2] = useRangeValue('0')
    const [v3, ref3] = useRangeValue('5')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Range"
                            description="Bootstrap range slider wrapper with optional label, min/max/step control, and disabled support."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — live value">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range
                                        ref={ref1}
                                        label="Volume"
                                        min="0"
                                        max="100"
                                        value="50"
                                    />
                                    <div className="form-text mt-1">Current value: {v1}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Min / Max / Step">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range
                                        ref={ref2}
                                        label="Temperature (°C)"
                                        min="-20"
                                        max="40"
                                        step="5"
                                        value="0"
                                    />
                                    <div className="form-text mt-1">Current value: {v2}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Step (1–10)">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range
                                        ref={ref3}
                                        label="Rating"
                                        min="1"
                                        max="10"
                                        step="1"
                                        value="5"
                                    />
                                    <div className="form-text mt-1">Current value: {v3}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No label">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range min="0" max="100" value="25" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range label="Disabled slider" value="60" disabled />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RangeDemo
