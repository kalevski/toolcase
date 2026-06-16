import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BrightnessCalibrationDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const [value, setValue] = useState(0.5)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => setValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Brightness Calibration"
                            description="Gamma/brightness calibration view with three grayscale reference swatches and a 0–1 brightness slider. Drag the slider until each band matches its instruction."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — live value">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brightness-calibration ref={ref} value="0.5" />
                                    <div className="form-text mt-2">
                                        Brightness: {Math.round(value * 100)}%
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Darker preset">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brightness-calibration value="0.2" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Brighter preset">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brightness-calibration value="0.85" />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BrightnessCalibrationDemo
