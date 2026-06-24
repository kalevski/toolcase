import React, { useEffect, useRef, useState } from 'react'

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
                        <tc-rich-page-header
                            title-text="Brightness Calibration"
                            description="Gamma/brightness calibration view with three grayscale reference swatches and a 0–1 brightness slider. Drag the slider until each band matches its instruction."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — live value">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brightness-calibration ref={ref} value="0.5" />
                                    <div className="form-text mt-2">
                                        Brightness: {Math.round(value * 100)}%
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Darker preset">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brightness-calibration value="0.2" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Brighter preset">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brightness-calibration value="0.85" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BrightnessCalibrationDemo
