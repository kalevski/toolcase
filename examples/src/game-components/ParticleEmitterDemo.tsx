import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ParticleEmitterDemo = () => {
    const [burst, setBurst] = useState('')

    return (
        <GcPage category="HUD — Display" title="gc-particle-emitter" lede="Canvas-based particle burst emitter for impact and reward effects.">
            <GcSection title="Burst trigger">
                <GcRow label="Explosion">
                    <button onClick={() => setBurst(String(Date.now()))} style={{ padding: '6px 14px', marginBottom: 12 }}>Trigger burst</button>
                    <gc-particle-emitter burst={burst} count="34" particle-size="3" speed="140" lifetime="900" />
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default ParticleEmitterDemo
