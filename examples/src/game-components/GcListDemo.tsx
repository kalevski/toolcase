import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const GcListDemo = () => (
    <GcPage category="Layout" title="gc-list" lede="A styled vertical list of labelled actions — icon, label, optional disabled state.">
        <GcSection title="Menu list">
            <GcRow label="Default">
                <gc-list items={JSON.stringify([
                    { id: 'new', label: 'New Game', icon: '🎮' },
                    { id: 'continue', label: 'Continue', icon: '💾' },
                    { id: 'options', label: 'Options', icon: '⚙' },
                    { id: 'quit', label: 'Quit', icon: '↩', disabled: true },
                ])} selected-id="new" />
            </GcRow>
        </GcSection>
        <GcSection title="Without icons">
            <GcRow label="Text only">
                <gc-list items={JSON.stringify([
                    { id: 'a', label: 'Profile' },
                    { id: 'b', label: 'Inventory' },
                    { id: 'c', label: 'Map' },
                    { id: 'd', label: 'Journal' },
                ])} selected-id="b" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default GcListDemo
