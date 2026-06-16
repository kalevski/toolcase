import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CircularProgressDemo: React.FC = () => {
    // Live-updating value, set via the JS `value` property on a ref.
    const liveRef = useRef<any>(null)
    const [value, setValue] = useState(25)

    useEffect(() => {
        const id = setInterval(() => {
            setValue(v => (v >= 100 ? 0 : v + 5))
        }, 600)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        if (liveRef.current) liveRef.current.value = value
    }, [value])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CircularProgress"
                            description="Ring / circular progress indicator with an optional value label. Neutral slate track, ink fill, JetBrains Mono percentage. Driven entirely by attributes — value, max, size, thickness, colors, and direction."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default with value label">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="0" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="25" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="50" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="75" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="100" show-text></tc-circular-progress>
                                </div>
                            </SectionCard>

                            <SectionCard title="Sizes and thickness">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="60" size="40" thickness="4" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="60" size="64" thickness="6" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="60" size="96" thickness="10" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="60" size="128" thickness="3" show-text></tc-circular-progress>
                                </div>
                            </SectionCard>

                            <SectionCard title="Status colors (color = information)">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="90" color="var(--tc-success)" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="55" color="var(--tc-warning)" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="30" color="var(--tc-danger)" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="70" color="var(--tc-info)" background="var(--tc-info-bg)" show-text></tc-circular-progress>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom max and reverse sweep">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="3" max="5" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="240" max="360" show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="40" reverse show-text></tc-circular-progress>
                                    {/* @ts-ignore */}
                                    <tc-circular-progress value="40"></tc-circular-progress>
                                </div>
                            </SectionCard>

                            <SectionCard title="Live value (set via JS property)">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-circular-progress ref={liveRef} size="80" thickness="8" color="var(--tc-app-accent)" show-text></tc-circular-progress>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CircularProgressDemo
