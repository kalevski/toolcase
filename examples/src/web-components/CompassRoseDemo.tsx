import React, { useEffect, useRef, useState } from 'react'

const CompassRoseDemo: React.FC = () => {
    const liveRef = useRef<any>(null)
    const [heading, setHeading] = useState(0)

    // Slowly sweep the heading so the needle rotates continuously, exercising
    // the rotation transition.
    useEffect(() => {
        const id = window.setInterval(() => {
            setHeading((h) => (h + 5) % 360)
        }, 120)
        return () => window.clearInterval(id)
    }, [])

    useEffect(() => {
        if (liveRef.current) liveRef.current.setAttribute('heading', String(heading))
    }, [heading])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CompassRose"
                            description="Radial compass rose showing a facing direction. The slate-ink needle rotates to the current heading while static N/E/S/W cardinals frame a flat slate face. Set heading and size via attributes; purely presentational with no events or slots."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-wrap gap-4 mt-4">
                            <tc-section-card title="Default (heading=0)">
                                {/* @ts-ignore */}
                                <tc-compass-rose />
                            </tc-section-card>

                            <tc-section-card title="Facing east (heading=90)">
                                {/* @ts-ignore */}
                                <tc-compass-rose heading="90" />
                            </tc-section-card>

                            <tc-section-card title="Facing southwest (heading=225)">
                                {/* @ts-ignore */}
                                <tc-compass-rose heading="225" />
                            </tc-section-card>

                            <tc-section-card title="Custom size (size=110)">
                                {/* @ts-ignore */}
                                <tc-compass-rose heading="135" size="110" />
                            </tc-section-card>

                            <tc-section-card title="Live heading sweep">
                                {/* @ts-ignore */}
                                <tc-compass-rose ref={liveRef} size="200" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompassRoseDemo
