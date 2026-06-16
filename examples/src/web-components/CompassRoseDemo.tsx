import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CompassRoseDemo: React.FC = () => {
    const liveRef = useRef<any>(null)
    const [heading, setHeading] = useState(0)

    // Slowly sweep the heading so the needle rotates continuously, exercising
    // the rotation transition.
    useEffect(() => {
        const id = window.setInterval(() => {
            setHeading(h => (h + 5) % 360)
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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CompassRose"
                            description="Radial compass rose showing a facing direction. The slate-ink needle rotates to the current heading while static N/E/S/W cardinals frame a flat slate face. Set heading and size via attributes; purely presentational with no events or slots."
                        />

                        <div className="d-flex flex-wrap gap-4 mt-4">
                            <SectionCard title="Default (heading=0)">
                                {/* @ts-ignore */}
                                <tc-compass-rose />
                            </SectionCard>

                            <SectionCard title="Facing east (heading=90)">
                                {/* @ts-ignore */}
                                <tc-compass-rose heading="90" />
                            </SectionCard>

                            <SectionCard title="Facing southwest (heading=225)">
                                {/* @ts-ignore */}
                                <tc-compass-rose heading="225" />
                            </SectionCard>

                            <SectionCard title="Custom size (size=110)">
                                {/* @ts-ignore */}
                                <tc-compass-rose heading="135" size="110" />
                            </SectionCard>

                            <SectionCard title="Live heading sweep">
                                {/* @ts-ignore */}
                                <tc-compass-rose ref={liveRef} size="200" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompassRoseDemo
