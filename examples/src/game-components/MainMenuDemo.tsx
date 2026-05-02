import { useState } from 'react'
import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const MainMenuDemo = () => {
    const [selected, setSelected] = useState('continue')
    return (
        <GcPage category="Menus & Dialogs" title="gc-main-menu" lede="Title-screen menu with hero, lore subtitle, and items list.">
            <GcSection title="Live demo">
                <div style={{ height: 600 }}>
                    <gc-main-menu
                        menu-title="EMBERFALL"
                        subtitle="The crown was hollow long before the king’s neck cooled."
                        selected-id={selected}
                        items={JSON.stringify([
                            { id: 'continue', label: 'Continue' },
                            { id: 'new', label: 'New Game' },
                            { id: 'load', label: 'Load Saga' },
                            { id: 'multi', label: 'Multiplayer' },
                            { id: 'settings', label: 'Settings' },
                            { id: 'codex', label: 'Codex' },
                            { id: 'quit', label: 'Quit to Desktop' },
                        ])}
                        onSelect={(event: CustomEvent<{ id: string }>) => setSelected(event.detail.id)}
                    />
                </div>
            </GcSection>
        </GcPage>
    )
}

export default MainMenuDemo
