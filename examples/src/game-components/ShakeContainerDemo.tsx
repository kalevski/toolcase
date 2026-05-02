import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ShakeContainerDemo = () => {
    const [trigger, setTrigger] = useState('')

    return (
        <GcPage category="HUD — Display" title="gc-shake-container" lede="Applies short camera-like shake to slotted content.">
            <GcSection title="Shake">
                <GcRow label="Impact">
                    <button onClick={() => setTrigger(String(Date.now()))} style={{ padding: '6px 14px', marginBottom: 12 }}>Shake</button>
                    <gc-shake-container trigger={trigger} intensity="10" duration="320">
                        <div style={{ width: 220, padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#e6e8ec' }}>
                            Objective Updated
                        </div>
                    </gc-shake-container>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default ShakeContainerDemo
