import React, { useCallback, useRef, useState } from 'react'
import { useTc, useTcEvents } from '@toolcase/web-components/react'

const ParticleEmitterDemo: React.FC = () => {
    const defaultRef = useTcEvents<HTMLElement>({
        'tc-burst': () => setBurstCount((n) => n + 1),
    })
    const cyanRef = useTc<HTMLElement>({
        colors: ['#22d3ee', '#06b6d4', '#0e7490', '#cffafe'],
    })
    const fastRef = useRef<any>(null)
    const heavyRef = useRef<any>(null)
    const [burstCount, setBurstCount] = useState(0)

    const handleBurst = useCallback((ref: { current: any }) => {
        if (ref.current) ref.current.burst()
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ParticleEmitter"
                            description="Canvas particle-burst emitter. Call burst() or toggle the burst attribute to spawn a wave of particles from the centre. Particle physics (count, speed, gravity, lifetime, size) are fully configurable via attributes; colours are set via the colors JS property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — slate/cyan palette">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-particle-emitter
                                        ref={defaultRef}
                                        width="280"
                                        height="180"
                                    />
                                    <div className="d-flex flex-column gap-2">
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => handleBurst(defaultRef)}
                                        >
                                            Burst
                                        </button>
                                        {burstCount > 0 && (
                                            <span className="badge bg-secondary font-monospace">
                                                tc-burst fired ×{burstCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Cyan palette (colors JS property)">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-particle-emitter ref={cyanRef} width="280" height="180" />
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleBurst(cyanRef)}
                                    >
                                        Burst
                                    </button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Fast + many particles (count=48, speed=350)">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-particle-emitter
                                        ref={fastRef}
                                        width="280"
                                        height="200"
                                        count="48"
                                        speed="350"
                                        particle-size="3"
                                    />
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleBurst(fastRef)}
                                    >
                                        Burst
                                    </button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Heavy gravity (gravity=1200, lifetime=500)">
                                <div className="d-flex align-items-start gap-3 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-particle-emitter
                                        ref={heavyRef}
                                        width="280"
                                        height="200"
                                        gravity="1200"
                                        lifetime="500"
                                        particle-size="6"
                                    />
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleBurst(heavyRef)}
                                    >
                                        Burst
                                    </button>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ParticleEmitterDemo
