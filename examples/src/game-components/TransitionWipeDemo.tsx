import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const TransitionWipeDemo = () => {
    const [show, setShow] = useState(false)

    return (
        <GcPage category="HUD — Display" title="gc-transition-wipe" lede="Scene transition cover supporting multiple wipe directions.">
            <GcSection title="Toggle">
                <GcRow label="Fade">
                    <button onClick={() => setShow((v) => !v)} style={{ padding: '6px 14px', marginBottom: 12 }}>
                        {show ? 'Hide wipe' : 'Show wipe'}
                    </button>
                    <div style={{ position: 'relative', height: 140, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(140deg, #1f334d, #4a2643)' }}>
                        <gc-transition-wipe show={show} direction="left" duration="600" wipe-color="#0a0c10" />
                    </div>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default TransitionWipeDemo
