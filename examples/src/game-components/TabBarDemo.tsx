import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const TabBarDemo = () => {
    const [active, setActive] = useState('display')
    const tabs = [
        { id: 'display', label: 'Display', icon: '⛯' },
        { id: 'audio', label: 'Audio', icon: '♪' },
        { id: 'controls', label: 'Controls', icon: '⚲' },
        { id: 'gameplay', label: 'Gameplay', icon: '⚔' },
    ]
    return (
        <GcPage category="Primitives — Atoms" title="gc-tab-bar" lede="Gilded tab strip with optional icons and active underline.">
            <GcSection title="Live demo">
                <GcRow label="Interactive">
                    <gc-tab-bar tabs={JSON.stringify(tabs)} active-id={active} onChange={(event: CustomEvent<{ id: string }>) => setActive(event.detail.id)} />
                </GcRow>
                <GcRow label="Active">
                    <code style={{ color: '#e6e8ec' }}>{active}</code>
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default TabBarDemo
