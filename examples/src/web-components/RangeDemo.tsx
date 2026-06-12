import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useRangeValue(initial: string): [string, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const input = e.target as HTMLInputElement
            if (input.tagName === 'INPUT') setValue(input.value)
        }
        el.addEventListener('input', handler)
        return () => el.removeEventListener('input', handler)
    }, [])

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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Range"
                            description="Bootstrap range slider wrapper with optional label, min/max/step control, and disabled support."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — live value">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range ref={ref1} label="Volume" min="0" max="100" value="50" />
                                    <div className="form-text mt-1">Current value: {v1}</div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Min / Max / Step">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range ref={ref2} label="Temperature (°C)" min="-20" max="40" step="5" value="0" />
                                    <div className="form-text mt-1">Current value: {v2}</div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Step (1–10)">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range ref={ref3} label="Rating" min="1" max="10" step="1" value="5" />
                                    <div className="form-text mt-1">Current value: {v3}</div>
                                </div>
                            </SectionCard>

                            <SectionCard title="No label">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range min="0" max="100" value="25" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-range label="Disabled slider" value="60" disabled />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RangeDemo
