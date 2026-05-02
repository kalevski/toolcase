import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ComboCounterDemo = () => {
    const [combo, setCombo] = useState(0)

    return (
        <GcPage category="HUD — Display" title="gc-combo-counter" lede="Displays the current combo hit count and resets after an inactivity timer.">
            <GcSection title="Interactive">
                <GcRow label="Click to add">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                        <gc-combo-counter combo={combo} timer="1.2" />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setCombo((v) => v + 1)} style={{ padding: '6px 14px' }}>Hit!</button>
                            <button onClick={() => setCombo(0)} style={{ padding: '6px 14px' }}>Reset</button>
                        </div>
                    </div>
                </GcRow>
            </GcSection>
            <GcSection title="Static values">
                <GcRow label="High combo">
                    <gc-combo-counter combo={42} timer="0" />
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default ComboCounterDemo
