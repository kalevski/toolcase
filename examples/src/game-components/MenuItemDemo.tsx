import { useState } from 'react'
import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const MenuItemDemo = () => {
    const [selected, setSelected] = useState('Continue')
    const items = [
        { label: 'Continue', hotkey: 'Esc' },
        { label: 'Inventory', hotkey: 'I' },
        { label: 'Map & Codex', hotkey: 'M' },
        { label: 'Skills', hotkey: 'K' },
        { label: 'Settings', hotkey: 'O' },
        { label: 'Save & Quit', hotkey: 'Q' },
    ]
    return (
        <GcPage category="Primitives — Atoms" title="gc-menu-item" lede="Uniform menu row with selected state, leading caret, and trailing keycap.">
            <GcSection title="Live demo">
                <div style={{ width: 280 }}>
                    {items.map((item) => (
                        <gc-menu-item
                            key={item.label}
                            label={item.label}
                            hotkey={item.hotkey}
                            selected={selected === item.label || undefined}
                            onSelect={() => setSelected(item.label)}
                        />
                    ))}
                </div>
            </GcSection>
        </GcPage>
    )
}

export default MenuItemDemo
