import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PauseScreenDemo = () => {
    const [open, setOpen] = useState(false)
    return (
        <GcPage category="Menus & Dialogs" title="gc-pause-screen" lede="Full-screen pause backdrop wrapper.">
            <GcSection title="Live demo">
                <GcRow label="Toggle">
                    <button onClick={() => setOpen(true)} style={{ padding: '6px 12px' }}>Open pause screen</button>
                </GcRow>
            </GcSection>
            <gc-pause-screen open={open || undefined}>
                <div style={{ color: '#f0d27a', fontFamily: 'serif', fontSize: 32, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Paused</div>
                <button onClick={() => setOpen(false)} style={{ marginTop: 16, padding: '6px 12px' }}>Resume</button>
            </gc-pause-screen>
        </GcPage>
    )
}

export default PauseScreenDemo
