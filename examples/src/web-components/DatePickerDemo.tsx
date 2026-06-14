import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useDateValue(initial: string): [string, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: CustomEvent) => setValue(e.detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Date Picker"
                            description="Native HTML5 date input wrapper with optional label, min/max constraints, and disabled support."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Labelled with initial value">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker ref={ref1} label="Event date" value="2026-06-14" />
                                    <div className="form-text mt-1">Selected: {v1 || '—'}</div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Min / Max constraints">
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
                            </SectionCard>

                            <SectionCard title="No label">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker value="2026-01-01" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-date-picker label="Locked date" value="2026-06-14" disabled />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DatePickerDemo
