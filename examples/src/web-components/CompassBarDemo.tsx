import React, { useEffect, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Markers shared across the cardinal + marker demos. Most use the default ink
// accent; one spends the rare cyan highlight for an objective.
const SHARED_MARKERS = [
    { id: 'obj', heading: 30, label: 'Objective', color: 'var(--tc-accent)' },
    { id: 'ally', heading: 75, label: 'Ally' },
    { id: 'home', heading: 350, label: 'Base', icon: '⌂' },
]
const CARDINAL_MARKERS = [{ id: 'waypoint', heading: 120, label: 'Waypoint' }]
const LIVE_MARKERS = [
    { id: 'n-marker', heading: 0, label: 'North', color: 'var(--tc-accent)' },
    { id: 'e-marker', heading: 90, label: 'East' },
    { id: 's-marker', heading: 180, label: 'South' },
    { id: 'w-marker', heading: 270, label: 'West' },
]

const CompassBarDemo: React.FC = () => {
    const [heading, setHeading] = useState(0)

    const cardinalsRef = useTc<HTMLElement>({ markers: CARDINAL_MARKERS })
    const markersRef = useTc<HTMLElement>({ markers: SHARED_MARKERS })
    const narrowRef = useTc<HTMLElement>({ markers: SHARED_MARKERS })
    const liveRef = useTc<HTMLElement>({ markers: LIVE_MARKERS })

    // A live-tracking strip: slowly sweep the heading so cardinals and markers
    // slide across the field of view.
    useEffect(() => {
        const id = window.setInterval(() => {
            setHeading((h) => (h + 2) % 360)
        }, 80)
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
                            title-text="CompassBar"
                            description="Horizontal compass strip showing a slice of the heading ring (the field of view) with cardinal ticks and positioned markers. Set heading/fov via attributes and markers via the JS markers property. A fixed ink pointer marks the current bearing; the mono readout shows the zero-padded degrees."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Heading readout only">
                                {/* @ts-ignore */}
                                <tc-compass-bar heading="45" />
                            </tc-section-card>

                            <tc-section-card title="With cardinal ticks (show-cardinals)">
                                {/* @ts-ignore */}
                                <tc-compass-bar
                                    ref={cardinalsRef}
                                    heading="60"
                                    fov="120"
                                    show-cardinals
                                />
                            </tc-section-card>

                            <tc-section-card title="Cardinals and markers">
                                {/* @ts-ignore */}
                                <tc-compass-bar
                                    ref={markersRef}
                                    heading="20"
                                    fov="140"
                                    width="420"
                                    show-cardinals
                                />
                            </tc-section-card>

                            <tc-section-card title="Narrow field of view (fov=60)">
                                {/* @ts-ignore */}
                                <tc-compass-bar
                                    ref={narrowRef}
                                    heading="40"
                                    fov="60"
                                    width="360"
                                    show-cardinals
                                />
                            </tc-section-card>

                            <tc-section-card title="Live heading sweep">
                                {/* @ts-ignore */}
                                <tc-compass-bar
                                    ref={liveRef}
                                    fov="120"
                                    width="420"
                                    height="36"
                                    show-cardinals
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompassBarDemo
