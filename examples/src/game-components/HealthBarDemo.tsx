import { useState, useEffect } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const HealthBarDemo = () => {
    const [hp, setHp] = useState(72)
    const [ghost, setGhost] = useState(95)

    useEffect(() => {
        const settle = window.setTimeout(() => setGhost(hp), 600)
        return () => window.clearTimeout(settle)
    }, [hp])

    return (
        <GcPage category="HUD — Resource Bars" title="gc-health-bar" lede="An HP bar with optional ghost damage trail, segmented mode, and label.">
            <GcSection title="Live demo" caption="Drag the slider to deal damage and watch the ghost bar settle.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ width: 280 }}>
                        <gc-health-bar value={hp} max={100} ghost={ghost} show-text label="HP" />
                    </div>
                    <input type="range" min={0} max={100} value={hp} onChange={(e) => setHp(Number(e.target.value))} style={{ width: 280 }} />
                </div>
            </GcSection>
            <GcSection title="Variants">
                <GcRow label="Full">
                    <div style={{ width: 220 }}><gc-health-bar value={100} max={100} show-text label="HP" /></div>
                </GcRow>
                <GcRow label="Low HP">
                    <div style={{ width: 220 }}><gc-health-bar value={15} max={100} show-text label="HP" /></div>
                </GcRow>
                <GcRow label="Segmented">
                    <div style={{ width: 220 }}><gc-health-bar value={65} max={100} segments={5} show-text label="HP" /></div>
                </GcRow>
                <GcRow label="No label">
                    <div style={{ width: 220 }}><gc-health-bar value={48} max={100} /></div>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default HealthBarDemo
