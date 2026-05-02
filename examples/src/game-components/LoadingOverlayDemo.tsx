import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const LoadingOverlayDemo = () => {
    const [open, setOpen] = useState(false)
    return (
        <GcPage category="Menus & Dialogs" title="gc-loading-overlay" lede="Lightweight modal loader for inline waits.">
            <GcSection title="Live demo">
                <GcRow label="Toggle">
                    <button onClick={() => { setOpen(true); window.setTimeout(() => setOpen(false), 1500) }} style={{ padding: '6px 12px' }}>Show 1.5s</button>
                </GcRow>
            </GcSection>
            <gc-loading-overlay open={open || undefined} label="Saving the world…" tip="Auto-save in progress." progress={0.4} />
        </GcPage>
    )
}

export default LoadingOverlayDemo
