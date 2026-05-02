import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'
import type { CrosshairVariant } from '@toolcase/game-components'

const variants: CrosshairVariant[] = ['cross', 'dot', 'circle', 'tShape', 'classic', 'rune']

const VisualizationDemo: React.FC = () => {
    const [speed, setSpeed] = useState(80)
    const emitterRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const id = window.setInterval(() => setSpeed(s => (s + 7) % 220), 200)
        return () => window.clearInterval(id)
    }, [])

    const fireBurst = () => {
        const el = emitterRef.current as any
        if (el) el.burst()
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Visualization"
                        description="Crosshair / Speedometer / Brightness calibration / Particle emitter."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Crosshair variants" />
                            <div className="d-flex gap-4 align-items-center" style={{ background: 'var(--fg-ink)', padding: 30 }}>
                                {variants.map(v => (
                                    <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                        {/* @ts-ignore */}
                                        <gc-crosshair variant={v} size="36" thickness="2" gap="6" color="#f0d27a" />
                                        <span style={{ fontFamily: 'var(--fg-mono)', fontSize: 10, color: 'var(--fg-parch-3)' }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Crosshair spread" />
                            <div className="d-flex gap-4 align-items-center" style={{ background: 'var(--fg-ink)', padding: 30 }}>
                                {/* @ts-ignore */}
                                <gc-crosshair variant="cross" size="40" thickness="2" gap="4" spread="0" color="#f0d27a" />
                                {/* @ts-ignore */}
                                <gc-crosshair variant="cross" size="40" thickness="2" gap="4" spread="6" color="#f0d27a" />
                                {/* @ts-ignore */}
                                <gc-crosshair variant="cross" size="40" thickness="2" gap="4" spread="12" color="#f0d27a" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Speedometer (animated)" />
                            <div className="d-flex gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <gc-speedometer value={speed} max="220" rpm={(speed / 220) * 7000} unit="KM/H" gear="5" size="180" />
                                {/* @ts-ignore */}
                                <gc-speedometer value="195" max="220" rpm="6800" unit="KM/H" gear="6" size="160" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Brightness calibration" />
                            <div style={{ width: 480 }}>
                                {/* @ts-ignore */}
                                <gc-brightness-calibration value="0.5" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Particle emitter (click to burst)" />
                            <div className="d-flex gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={fireBurst}>Burst</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-particle-emitter ref={emitterRef} width="280" height="180" count="50" speed="220" lifetime="800" gravity="700" particle-size="5" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VisualizationDemo
