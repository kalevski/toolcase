import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'
import type { TcRef } from '@toolcase/web-components/react'

function useDateValue(initial: string): [string, TcRef] {
    const [value, setValue] = useState(initial)
    const ref = useTcEvents<HTMLElement>({
        'tc-change': (e: CustomEvent) => setValue(e.detail.value),
    })

    return [value, ref]
}

const DatePickerDemo: React.FC = () => {
    const [v1, ref1] = useDateValue('2026-06-14')
    const [v2, ref2] = useDateValue('')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Date Picker"
                            description="Native HTML5 date input wrapper with optional label, min/max constraints, and disabled support."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Labelled with initial value">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker
                                        ref={ref1}
                                        label="Event date"
                                        value="2026-06-14"
                                    />
                                    <div className="form-text mt-1">Selected: {v1 || '—'}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Min / Max constraints">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker
                                        ref={ref2}
                                        label="Booking date"
                                        min="2026-06-01"
                                        max="2026-12-31"
                                    />
                                    <div className="form-text mt-1">Selected: {v2 || '—'}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No label">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker value="2026-01-01" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker
                                        label="Locked date"
                                        value="2026-06-14"
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

export default DatePickerDemo
