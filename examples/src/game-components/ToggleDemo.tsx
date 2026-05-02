import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ToggleDemo = () => {
    const [on, setOn] = useState(true)
    return (
        <GcPage category="Primitives — Atoms" title="gc-toggle" lede="Bare on/off toggle with gilded slider thumb.">
            <GcSection title="Live demo">
                <GcRow label="Interactive">
                    <gc-toggle on={on || undefined} onChange={(event: CustomEvent<{ on: boolean }>) => setOn(event.detail.on)} />
                </GcRow>
                <GcRow label="State">
                    <code style={{ color: '#e6e8ec' }}>{on ? 'on' : 'off'}</code>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default ToggleDemo
