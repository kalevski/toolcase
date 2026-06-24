import React, { useEffect, useRef, useState } from 'react'

function useTimeValue(initial: string): [string, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => setValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return [value, ref]
}

const TimePickerDemo: React.FC = () => {
    const [v24, ref24] = useTimeValue('09:30')
    const [v12, ref12] = useTimeValue('14:15')
    const [vSec, refSec] = useTimeValue('08:05:30')
    const [vClear, refClear] = useTimeValue('22:45')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Time Picker"
                            description="Time picker with a scrollable column interface supporting 12/24-hour formats, optional seconds, a clear button, and validation state."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="24-hour format">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-time-picker
                                        ref={ref24}
                                        label="Start time"
                                        value="09:30"
                                        minute-step="15"
                                    />
                                    <div className="form-text mt-1">
                                        Current value: {v24 || '(none)'}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="12-hour format (AM/PM column)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-time-picker
                                        ref={ref12}
                                        label="Meeting time"
                                        format="12h"
                                        value="14:15"
                                        minute-step="5"
                                    />
                                    <div className="form-text mt-1">
                                        Current value (24h): {v12 || '(none)'}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With seconds">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-time-picker
                                        ref={refSec}
                                        label="Timestamp"
                                        show-seconds
                                        value="08:05:30"
                                    />
                                    <div className="form-text mt-1">
                                        Current value: {vSec || '(none)'}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Clearable">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-time-picker
                                        ref={refClear}
                                        label="Reminder"
                                        clearable
                                        value="22:45"
                                    />
                                    <div className="form-text mt-1">
                                        Current value: {vClear || '(none)'}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Error state">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-time-picker
                                        label="Closing time"
                                        error="Please choose a valid time"
                                        placeholder="Pick a time"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-time-picker label="Locked" value="12:00" disabled />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TimePickerDemo
