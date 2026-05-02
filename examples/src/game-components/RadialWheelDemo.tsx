import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const RadialWheelDemo = () => {
    const [open, setOpen] = useState(true)

    return (
        <GcPage category="HUD — Skills" title="gc-radial-wheel" lede="Context wheel for quick ability or command selection.">
            <GcSection title="Open menu">
                <GcRow label="Commands">
                    <button onClick={() => setOpen(true)} style={{ padding: '6px 14px', marginBottom: 12 }}>Open wheel</button>
                    <div style={{ position: 'relative', height: 300 }}>
                        <gc-radial-wheel
                            open={open}
                            center-label="Commands"
                            options={[
                                { id: 'heal', icon: '❤', label: 'Heal' },
                                { id: 'ping', icon: '📍', label: 'Ping' },
                                { id: 'guard', icon: '🛡', label: 'Guard' },
                                { id: 'focus', icon: '✦', label: 'Focus' },
                            ]}
                            onClose={() => setOpen(false)}
                        />
                    </div>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default RadialWheelDemo
