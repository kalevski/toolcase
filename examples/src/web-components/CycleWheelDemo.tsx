import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CycleWheelDemo: React.FC = () => {
    const mainRef = useRef<any>(null)
    const threeRef = useRef<any>(null)
    const pausedRef = useRef<any>(null)

    const phases = ['Roll', 'Build', 'Attest', 'Ship', 'Close']
    const [current, setCurrent] = useState(1)
    const [paused, setPaused] = useState(false)

    // phases is a JS property (array of strings) — must be set via ref, not attribute.
    useEffect(() => {
        if (mainRef.current) mainRef.current.phases = phases
    }, [])

    useEffect(() => {
        if (threeRef.current) threeRef.current.phases = ['Draft', 'Review', 'Ship']
    }, [])

    useEffect(() => {
        if (pausedRef.current) pausedRef.current.phases = phases
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CycleWheel"
                            description="Rotating SVG ring of phase labels around a fixed centre showing the current state, with an arrow pointer that orients to the active phase."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — five-phase loop (interactive)">
                                <div style={{ maxWidth: 420, margin: '0 auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-cycle-wheel
                                        ref={mainRef}
                                        current-index={current}
                                        paused={paused}
                                        center-label="Now · Sprint"
                                        center-value="047"
                                        center-pill="Open"
                                        center-sub="Day 03 / 14"
                                    />
                                </div>
                                <div className="d-flex gap-2 justify-content-center mt-3">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setCurrent((c) => (c + 1) % phases.length)}
                                    >
                                        Next phase ({phases[current]})
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setPaused((p) => !p)}
                                    >
                                        {paused ? 'Resume' : 'Pause'}
                                    </button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Three-phase variant — faster spin (spin-seconds=12)">
                                <div style={{ maxWidth: 320, margin: '0 auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-cycle-wheel
                                        ref={threeRef}
                                        current-index={2}
                                        spin-seconds={12}
                                        center-value="v2"
                                        center-pill="Live"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Paused — the spin is stopped via the paused attribute">
                                <div style={{ maxWidth: 420, margin: '0 auto' }}>
                                    {/* @ts-ignore */}
                                    <tc-cycle-wheel
                                        ref={pausedRef}
                                        current-index={3}
                                        paused
                                        center-label="Frozen"
                                        center-value="047"
                                        center-pill="Ship"
                                        center-sub="Animation paused"
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CycleWheelDemo
