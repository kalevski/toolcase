import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SpeedometerDemo: React.FC = () => {
    const [liveValue, setLiveValue] = useState(0)
    const liveRef = useRef<any>(null)

    useEffect(() => {
        if (liveRef.current) {
            liveRef.current.value = liveValue
        }
    }, [liveValue])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Speedometer"
                            description="Vehicle speedometer gauge — a semicircular arc indicator with a JetBrains Mono readout. Supports optional gear, RPM, and a danger state at 85%+ of max."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic — default max 220 KM/H">
                                {/* @ts-ignore */}
                                <tc-speedometer value="120" />
                            </SectionCard>

                            <SectionCard title="With gear and RPM">
                                {/* @ts-ignore */}
                                <tc-speedometer value="145" gear="4" rpm="3200" />
                            </SectionCard>

                            <SectionCard title="Danger zone (≥ 85% of max)">
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-speedometer value="200" />
                                    {/* @ts-ignore */}
                                    <tc-speedometer value="210" gear="6" rpm="6800" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Zero / empty">
                                {/* @ts-ignore */}
                                <tc-speedometer value="0" />
                            </SectionCard>

                            <SectionCard title="Custom max and unit (180 MPH)">
                                {/* @ts-ignore */}
                                <tc-speedometer value="95" max="180" unit="MPH" />
                            </SectionCard>

                            <SectionCard title="Sizes">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-speedometer value="80" size="120" />
                                    {/* @ts-ignore */}
                                    <tc-speedometer value="80" size="160" />
                                    {/* @ts-ignore */}
                                    <tc-speedometer value="80" size="220" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Interactive — drag slider">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-speedometer ref={liveRef} value="0" gear="1" rpm="800" size="200" />
                                    <div className="d-flex align-items-center gap-2" style={{ maxWidth: '220px' }}>
                                        <input
                                            type="range"
                                            min={0}
                                            max={220}
                                            value={liveValue}
                                            className="form-range"
                                            onChange={e => {
                                                const v = Number(e.target.value)
                                                setLiveValue(v)
                                                if (liveRef.current) {
                                                    liveRef.current.rpm = Math.round(v * 40)
                                                    liveRef.current.gear = v < 40 ? '1' : v < 80 ? '2' : v < 120 ? '3' : v < 160 ? '4' : v < 190 ? '5' : '6'
                                                }
                                            }}
                                        />
                                        <span className="font-monospace" style={{ minWidth: '3.5ch' }}>{liveValue}</span>
                                    </div>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SpeedometerDemo
