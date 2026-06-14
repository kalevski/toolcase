import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const coloredSlices = [
    { label: 'JavaScript', value: 4820, color: '#f59e0b' },
    { label: 'TypeScript', value: 3140, color: '#6366f1' },
    { label: 'Python', value: 2200, color: '#22c55e' },
    { label: 'Rust', value: 980, color: '#ef4444' },
    { label: 'Go', value: 760, color: '#06b6d4' },
]

const slateSlices = [
    { label: 'Open', value: 142 },
    { label: 'In Progress', value: 87 },
    { label: 'Review', value: 34 },
    { label: 'Closed', value: 218 },
]

const SlicesCardDemo: React.FC = () => {
    const coloredRef = useRef<any>(null)
    const slateRef = useRef<any>(null)

    useEffect(() => {
        if (coloredRef.current) {
            coloredRef.current.slices = coloredSlices
        }
        if (slateRef.current) {
            slateRef.current.slices = slateSlices
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="SlicesCard"
                            description="Dashboard card with a donut/pie chart and an item legend. Driven by a JS property array of slices."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Colored slices — caller-supplied colors">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-slices-card ref={coloredRef} title="Downloads by Language" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Uncolored slate set — quiet default ramp">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-slices-card ref={slateRef} title="Issues by Status" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom size and stroke-width">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-slices-card
                                        ref={(el: any) => { if (el) el.slices = coloredSlices }}
                                        title="Large donut"
                                        size="200"
                                        stroke-width="32"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-slices-card loading title="Downloads" />
                                    {/* @ts-ignore */}
                                    <tc-slices-card loading />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SlicesCardDemo
