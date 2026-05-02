import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ScreenFlashDemo = () => {
    const [trigger, setTrigger] = useState('')

    return (
        <GcPage category="HUD — Display" title="gc-screen-flash" lede="Full-screen flash pulse used for hit feedback and transitions.">
            <GcSection title="Trigger">
                <GcRow label="Damage flash">
                    <button onClick={() => setTrigger(String(Date.now()))} style={{ padding: '6px 14px', marginBottom: 12 }}>Flash screen</button>
                    <div style={{ position: 'relative', height: 140, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(140deg, #20354f, #4f2835)' }}>
                        <gc-screen-flash trigger={trigger} flash-color="#ff6262" flash-opacity="0.5" duration="280" />
                    </div>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default ScreenFlashDemo
