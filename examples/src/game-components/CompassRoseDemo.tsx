import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const CompassRoseDemo: React.FC = () => {
    const [heading, setHeading] = useState(0)
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        if (ref.current) {
            ref.current.setAttribute('heading', String(heading))
        }
    }, [heading])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CompassRose"
                        description="Cardinal compass with rotating needle. Props: heading (degrees), size."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default (heading 0)" />
                            {/* @ts-ignore */}
                            <gc-compass-rose />
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Static headings" />
                            <div className="d-flex gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-compass-rose heading="0" />
                                {/* @ts-ignore */}
                                <gc-compass-rose heading="45" />
                                {/* @ts-ignore */}
                                <gc-compass-rose heading="90" />
                                {/* @ts-ignore */}
                                <gc-compass-rose heading="180" />
                                {/* @ts-ignore */}
                                <gc-compass-rose heading="270" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Live (drag slider)" />
                            <div className="d-flex gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-compass-rose ref={ref} size="96" />
                                <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    value={heading}
                                    onChange={(e) => setHeading(Number(e.target.value))}
                                    style={{ width: 240 }}
                                />
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                    {heading}°
                                </span>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CompassRoseDemo
