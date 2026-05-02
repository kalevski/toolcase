import { useState } from 'react'
import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const SettingsCategoryListDemo = () => {
    const [active, setActive] = useState('display')
    return (
        <GcPage category="Settings" title="gc-settings-category-list" lede="Side-tab list of setting groups.">
            <GcSection title="Live demo">
                <div style={{ height: 320 }}>
                    <gc-settings-category-list active-id={active} categories={JSON.stringify([
                        { id: 'display', label: 'Display', icon: '⛯' },
                        { id: 'audio', label: 'Audio', icon: '♪' },
                        { id: 'controls', label: 'Controls', icon: '⚲' },
                        { id: 'gameplay', label: 'Gameplay', icon: '⚔' },
                        { id: 'access', label: 'Accessibility', icon: '✶' },
                    ])} onChange={(event: CustomEvent<{ id: string }>) => setActive(event.detail.id)} />
                </div>
            </GcSection>
        </GcPage>
    )
}

export default SettingsCategoryListDemo
