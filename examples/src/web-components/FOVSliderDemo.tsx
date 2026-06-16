import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useFovValue(initial: number): [number, React.RefObject<any>] {
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

const FOVSliderDemo: React.FC = () => {
    const [v1, ref1] = useFovValue(90)
    const [v2, ref2] = useFovValue(103)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="FOV Slider"
                            description="A field-of-view setting row: a label/description block paired with a range control and a mono degree readout. Built on the shared tc-setting-row scaffold."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — defaults to 'Field of View' at 90°">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fov-slider ref={ref1} value="90" />
                                </div>
                                <div className="form-text mt-1">Current value: {Math.round(v1)}°</div>
                            </SectionCard>

                            <SectionCard title="Custom label + description + range">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fov-slider
                                        ref={ref2}
                                        row-label="Vertical FOV"
                                        description="Widen for ultrawide displays; higher values show more of the world."
                                        min="70"
                                        max="140"
                                        value="103"
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {Math.round(v2)}°</div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-fov-slider
                                        row-label="Field of View"
                                        description="Locked while a cinematic is playing."
                                        value="90"
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

export default FOVSliderDemo
