import React, { useEffect, useRef, useState } from 'react'

const LAYOUTS = ['generic', 'xbox', 'playstation', 'nintendo'] as const

const ControllerLayoutPreviewDemo: React.FC = () => {
    const liveRef = useRef<any>(null)
    const [idx, setIdx] = useState(0)

    // Cycle through the four layouts so the face-button bindings relabel live.
    useEffect(() => {
        const id = window.setInterval(() => {
            setIdx((i) => (i + 1) % LAYOUTS.length)
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
                        <tc-rich-page-header
                            title-text="ControllerLayoutPreview"
                            description="A gamepad diagram with labeled face-button bindings. The four face buttons relabel per the layout attribute — Xbox A/B/X/Y, PlayStation ✕/◯/△/☐, Nintendo's swapped A/B/X/Y, or the generic directional triangles. Flat slate body, hairline strokes, mono glyph labels; purely presentational with no events or slots."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-wrap gap-4 mt-4">
                            <tc-section-card title="Generic (default)">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview />
                            </tc-section-card>

                            <tc-section-card title="Xbox">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview layout="xbox" />
                            </tc-section-card>

                            <tc-section-card title="PlayStation">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview layout="playstation" />
                            </tc-section-card>

                            <tc-section-card title="Nintendo">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview layout="nintendo" />
                            </tc-section-card>

                            <tc-section-card title="Live layout cycle">
                                {/* @ts-ignore */}
                                <tc-controller-layout-preview ref={liveRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ControllerLayoutPreviewDemo
