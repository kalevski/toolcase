import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const HitMarkerDemo = () => {
    const [n, setN] = useState(0)
    const [crit, setCrit] = useState(0)

    return (
        <GcPage category="HUD — Combat" title="gc-hit-marker" lede="Briefly shows a hit confirmation graphic in the centre of the viewport. Supports regular and critical variants.">
            <GcSection title="Trigger">
                <GcRow label="Regular hit">
                    <button onClick={() => setN((v) => v + 1)} style={{ padding: '6px 14px', marginBottom: 12 }}>Trigger hit</button>
                    <div style={{ position: 'relative', width: 120, height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                        <gc-hit-marker trigger={String(n)} duration="400" />
                    </div>
                </GcRow>
                <GcRow label="Critical hit">
                    <button onClick={() => setCrit((v) => v + 1)} style={{ padding: '6px 14px', marginBottom: 12 }}>Trigger crit</button>
                    <div style={{ position: 'relative', width: 120, height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                        <gc-hit-marker trigger={String(crit)} crit duration="400" />
                    </div>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default HitMarkerDemo
