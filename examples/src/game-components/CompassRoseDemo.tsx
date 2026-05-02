import { useState, useEffect } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CompassRoseDemo = () => {
    const [heading, setHeading] = useState(0)
    const [live, setLive] = useState(true)

    useEffect(() => {
        if (!live) return
        const id = window.setInterval(() => setHeading((h) => (h + 1) % 360), 50)
        return () => window.clearInterval(id)
    }, [live])

    return (
        <GcPage category="HUD — Navigation" title="gc-compass-rose" lede="A circular compass rose that rotates to indicate the player's current heading.">
            <GcSection title="Live rotation">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
                    <gc-compass-rose heading={heading} size="100" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="range" min={0} max={359} value={heading} onChange={(e) => { setLive(false); setHeading(Number(e.target.value)) }} style={{ width: 200 }} />
                        <button onClick={() => setLive((v) => !v)} style={{ padding: '4px 10px' }}>{live ? 'Pause' : 'Animate'}</button>
                        <span style={{ color: 'rgba(230,232,236,0.55)', fontSize: 12 }}>{heading}°</span>
                    </div>
                </div>
            </GcSection>
            <GcSection title="Sizes">
                <GcRow label="Small / Large">
                    <gc-stack direction="horizontal" gap="24px" style={{ alignItems: 'center' } as never}>
                        <gc-compass-rose heading={45} size="60" />
                        <gc-compass-rose heading={135} size="100" />
                        <gc-compass-rose heading={225} size="140" />
                    </gc-stack>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default CompassRoseDemo
