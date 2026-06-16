import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DebugOverlayDemo: React.FC = () => {
    const customRef = useRef<any>(null)
    const liveRef = useRef<any>(null)

    useEffect(() => {
        if (customRef.current) {
            customRef.current.rows = [
                { label: 'Entities', value: 1_284 },
                { label: 'Sprites', value: 642 },
                { label: 'Audio', value: '12 / 32' },
                { label: 'Scene', value: 'Level 3' },
            ]
        }
    }, [])

    // Drive the live panel with a fluctuating fps reading so the status colour
    // transitions (good → warning → danger) are visible.
    useEffect(() => {
        const el = liveRef.current
        if (!el) return
        let frame = 0
        const id = window.setInterval(() => {
            frame += 1
            const fps = 30 + Math.round(30 * Math.abs(Math.sin(frame / 6)))
            el.fps = fps
            el.drawCalls = 120 + (frame % 40)
            el.memMb = 256 + (frame % 16)
        }, 600)
        return () => window.clearInterval(id)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="DebugOverlay"
                            description="Dev/perf overlay rendering an fps readout and key/value stat lines on a dark machine-facing panel. Built-in stats (fps, draw-calls, triangles, mem-mb) are attributes; arbitrary stat lines are set via the JS rows property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Built-in stats (fps colour-codes by threshold)">
                                <div className="d-flex flex-wrap gap-4">
                                    {/* @ts-ignore */}
                                    <tc-debug-overlay fps="60" draw-calls="118" triangles="48213" mem-mb="312" />
                                    {/* @ts-ignore */}
                                    <tc-debug-overlay fps="42" draw-calls="240" triangles="91044" mem-mb="498" />
                                    {/* @ts-ignore */}
                                    <tc-debug-overlay fps="24" draw-calls="512" triangles="184320" mem-mb="742" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom rows (rows JS property)">
                                {/* @ts-ignore */}
                                <tc-debug-overlay ref={customRef} fps="58" />
                            </SectionCard>

                            <SectionCard title="Live (fps fluctuates every 600ms)">
                                {/* @ts-ignore */}
                                <tc-debug-overlay ref={liveRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DebugOverlayDemo
