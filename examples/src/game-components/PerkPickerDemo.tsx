import { useState } from 'react'
import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const PerkPickerDemo = () => {
    const [selected, setSelected] = useState('embers')
    return (
        <GcPage category="Progression" title="gc-perk-picker" lede="Choose-one card grid for level-up perks.">
            <GcSection title="Live demo">
                <gc-perk-picker selected-id={selected} columns={3} perks={JSON.stringify([
                    { id: 'embers', name: 'Embers', icon: '🔥', desc: '+12% fire damage.' },
                    { id: 'frost', name: 'Frost Bite', icon: '❄', desc: 'Crits slow targets by 30%.' },
                    { id: 'aegis', name: 'Aegis', icon: '🛡', desc: '+18% block effectiveness.' },
                ])} onSelect={(event: CustomEvent<{ id: string }>) => setSelected(event.detail.id)} />
            </GcSection>
        </GcPage>
    )
}

export default PerkPickerDemo
