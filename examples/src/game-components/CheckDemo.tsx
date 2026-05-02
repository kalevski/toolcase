import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CheckDemo = () => {
    const [on, setOn] = useState(false)
    return (
        <GcPage category="Primitives — Atoms" title="gc-check" lede="Bare gilded checkbox with a clip-path checkmark.">
            <GcSection title="Live demo">
                <GcRow label="Interactive">
                    <gc-check on={on || undefined} onChange={(event: CustomEvent<{ on: boolean }>) => setOn(event.detail.on)} />
                </GcRow>
                <GcRow label="State">
                    <code style={{ color: '#e6e8ec' }}>{on ? 'checked' : 'unchecked'}</code>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default CheckDemo
