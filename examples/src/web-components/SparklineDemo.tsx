import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SparklineDemo: React.FC = () => {
    const barRef = useRef<any>(null)
    const customColorRef = useRef<any>(null)

    useEffect(() => {
        if (barRef.current) {
            barRef.current.data = [12, 40, 28, 55, 38, 70, 45, 62, 80, 55]
        }
    }, [])

    useEffect(() => {
        if (customColorRef.current) {
            customColorRef.current.data = [5, 30, 20, 60, 45, 75, 50]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Sparkline"
                            description="Compact inline SVG micro-chart for quick trend display. Supports line and bar types; scales data values into a fixed box. Suitable for embedding inside metric rows or prose."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Line type (data attribute)">
                                <p className="mb-2" style={{ fontSize: '0.85rem', color: 'var(--tc-text-muted)' }}>
                                    Authored in plain HTML via the comma-separated <code>data</code> attribute.
                                </p>
                                {/* @ts-ignore */}
                                <tc-sparkline data="10,25,18,42,30,55,40,68,52,75" width="160" height="40"></tc-sparkline>
                            </SectionCard>

                            <SectionCard title="Bar type (JS property)">
                                <p className="mb-2" style={{ fontSize: '0.85rem', color: 'var(--tc-text-muted)' }}>
                                    Data set via the <code>data</code> JS property on the element ref.
                                </p>
                                {/* @ts-ignore */}
                                <tc-sparkline ref={barRef} type="bar" width="160" height="40"></tc-sparkline>
                            </SectionCard>

                            <SectionCard title="Custom color">
                                {/* @ts-ignore */}
                                <tc-sparkline ref={customColorRef} color="var(--tc-success)" width="160" height="40"></tc-sparkline>
                            </SectionCard>

                            <SectionCard title="Inline within a metric">
                                <p className="mb-0" style={{ fontSize: '1rem', lineHeight: '2' }}>
                                    Revenue{' '}
                                    <strong>$42,180</strong>
                                    {' '}
                                    {/* @ts-ignore */}
                                    <tc-sparkline data="30,38,35,44,40,50,47,55" height="24" width="80"></tc-sparkline>
                                    {' '}
                                    <span style={{ color: 'var(--tc-success)', fontSize: '0.85rem' }}>+12.4%</span>
                                </p>
                                <p className="mb-0 mt-2" style={{ fontSize: '1rem', lineHeight: '2' }}>
                                    Active users{' '}
                                    <strong>8,340</strong>
                                    {' '}
                                    {/* @ts-ignore */}
                                    <tc-sparkline data="80,75,70,65,60,55,50" type="bar" height="24" width="80" color="var(--tc-warning)"></tc-sparkline>
                                    {' '}
                                    <span style={{ color: 'var(--tc-danger)', fontSize: '0.85rem' }}>−7.1%</span>
                                </p>
                            </SectionCard>

                            <SectionCard title="Sizes">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-sparkline data="10,30,20,50,40,60" width="60" height="20"></tc-sparkline>
                                    {/* @ts-ignore */}
                                    <tc-sparkline data="10,30,20,50,40,60" width="120" height="32"></tc-sparkline>
                                    {/* @ts-ignore */}
                                    <tc-sparkline data="10,30,20,50,40,60" width="200" height="48"></tc-sparkline>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SparklineDemo
