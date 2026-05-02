import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PauseMenuDemo = () => {
    const [open, setOpen] = useState(false)
    return (
        <GcPage category="Menus & Dialogs" title="gc-pause-menu" lede="Centered overlay wrapper for pause-menu content.">
            <GcSection title="Live demo">
                <GcRow label="Toggle">
                    <button onClick={() => setOpen(true)} style={{ padding: '6px 12px' }}>Open pause menu</button>
                </GcRow>
            </GcSection>
            <gc-pause-menu open={open || undefined}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#e8dcc4', minWidth: 300 }}>
                    <div style={{ textAlign: 'center', fontFamily: 'serif', fontSize: 26, color: '#f0d27a' }}>PAUSED</div>
                    {['Resume', 'Inventory', 'Settings', 'Save & Quit'].map((label) => (
                        <gc-menu-item key={label} label={label} hotkey={label === 'Resume' ? 'Esc' : ''} selected={label === 'Resume' || undefined} />
                    ))}
                    <button onClick={() => setOpen(false)} style={{ marginTop: 8, padding: '6px 12px' }}>Close</button>
                </div>
            </gc-pause-menu>
        </GcPage>
    )
}

export default PauseMenuDemo
