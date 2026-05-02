import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const MARKERS = [
    { id: 'enemy', heading: 30, color: '#d44a3a', label: 'Enemy', icon: '⚔' },
    { id: 'objective', heading: 95, color: '#f0d27a', label: 'Goal', icon: '◆' },
    { id: 'ally', heading: 200, color: '#9fc55a', label: 'Ally', icon: '☩' }
]

const CompassBarDemo: React.FC = () => {
    const [heading, setHeading] = useState(0)
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.markers = MARKERS
    }, [])

    useEffect(() => {
        if (ref.current) ref.current.setAttribute('heading', String(heading))
    }, [heading])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CompassBar"
                        description="Horizontal heading strip with cardinal labels and FOV-culled markers."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Live (drag slider)" />
                            <div className="d-flex flex-column gap-3 align-items-start">
                                {/* @ts-ignore */}
                                <gc-compass-bar ref={ref} fov="120" width="360" show-cardinals />
                                <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    value={heading}
                                    onChange={(e) => setHeading(Number(e.target.value))}
                                    style={{ width: 360 }}
                                />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Without cardinals" />
                            {/* @ts-ignore */}
                            <gc-compass-bar heading="45" fov="90" width="320" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompassBarDemo
