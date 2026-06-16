import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useDeadzoneValue(initial: number): [number, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: number }>).detail
            if (detail) setValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return [value, ref]
}

const DeadzoneSliderDemo: React.FC = () => {
    const [v1, ref1] = useDeadzoneValue(0.15)
    const [v2, ref2] = useDeadzoneValue(0.25)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Deadzone Slider"
                            description="A stick-deadzone setting row: a label/description block paired with a 0–100% range control and a mono percentage readout. Built on the shared tc-setting-row scaffold."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — defaults to 'Stick deadzone' at 15%">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-deadzone-slider ref={ref1} value="0.15" />
                                </div>
                                <div className="form-text mt-1">
                                    Current value: {v1.toFixed(2)} ({Math.round(v1 * 100)}%)
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom label + description">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-deadzone-slider
                                        ref={ref2}
                                        row-label="Left stick deadzone"
                                        description="Ignore stick input below this threshold to avoid drift."
                                        value="0.25"
                                    />
                                </div>
                                <div className="form-text mt-1">
                                    Current value: {v2.toFixed(2)} ({Math.round(v2 * 100)}%)
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-deadzone-slider
                                        row-label="Right stick deadzone"
                                        description="Locked while the controller is calibrating."
                                        value="0.4"
                                        disabled
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeadzoneSliderDemo
