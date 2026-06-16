import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LAYOUTS = ['generic', 'xbox', 'playstation', 'nintendo'] as const

const ControllerLayoutPreviewDemo: React.FC = () => {
    const liveRef = useRef<any>(null)
    const [idx, setIdx] = useState(0)

    // Cycle through the four layouts so the face-button bindings relabel live.
    useEffect(() => {
        const id = window.setInterval(() => {
            setIdx(i => (i + 1) % LAYOUTS.length)
        }, 1800)
        return () => window.clearInterval(id)
    }, [])

    useEffect(() => {
        if (liveRef.current) liveRef.current.layout = LAYOUTS[idx]
    }, [idx])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ControllerLayoutPreview"
                            description="A gamepad diagram with labeled face-button bindings. The four face buttons relabel per the layout attribute — Xbox A/B/X/Y, PlayStation ✕/◯/△/☐, Nintendo's swapped A/B/X/Y, or the generic directional triangles. Flat slate body, hairline strokes, mono glyph labels; purely presentational with no events or slots."
                        />

                        <div className="d-flex flex-wrap gap-4 mt-4">
                            <SectionCard title="Generic (default)">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview />
                            </SectionCard>

                            <SectionCard title="Xbox">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview layout="xbox" />
                            </SectionCard>

                            <SectionCard title="PlayStation">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview layout="playstation" />
                            </SectionCard>

                            <SectionCard title="Nintendo">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview layout="nintendo" />
                            </SectionCard>

                            <SectionCard title="Live layout cycle">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview ref={liveRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ControllerLayoutPreviewDemo
