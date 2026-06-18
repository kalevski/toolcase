import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PingDisplayDemo: React.FC = () => {
    const liveRef = useRef<any>(null)

    useEffect(() => {
        const el = liveRef.current
        if (!el) return

        let direction = 1
        let ping = 20
        const id = setInterval(() => {
            ping += direction * 25
            if (ping >= 350) { ping = 350; direction = -1 }
            if (ping <= 20) { ping = 20; direction = 1 }
            el.ping = ping
        }, 700)

        return () => clearInterval(id)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PingDisplay"
                            description="Compact latency readout. Tiers: success (<60 ms), warning (<200 ms), danger (≥200 ms), unknown (no ping attribute). Renders a status pip and a JetBrains Mono millisecond value."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="All tiers">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-ping-display ping="22" />
                                    {/* @ts-ignore */}
                                    <tc-ping-display ping="59" />
                                    {/* @ts-ignore */}
                                    <tc-ping-display ping="120" />
                                    {/* @ts-ignore */}
                                    <tc-ping-display ping="199" />
                                    {/* @ts-ignore */}
                                    <tc-ping-display ping="350" />
                                    {/* @ts-ignore */}
                                    <tc-ping-display ping="999" />
                                    {/* @ts-ignore */}
                                    <tc-ping-display />
                                </div>
                            </SectionCard>

                            <SectionCard title="Unknown (no ping attribute)">
                                <div className="d-flex align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-ping-display />
                                    <span className="text-muted ms-2" style={{ fontSize: '0.8125rem' }}>
                                        No <code>ping</code> attribute — renders an em-dash in the unknown tier colour
                                    </span>
                                </div>
                            </SectionCard>

                            <SectionCard title="Live ping update (JS property)">
                                <div className="d-flex align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-ping-display ref={liveRef} />
                                    <span className="text-muted ms-2" style={{ fontSize: '0.8125rem' }}>
                                        Animates 20–350 ms every 700 ms via <code>el.ping = value</code>
                                    </span>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PingDisplayDemo
