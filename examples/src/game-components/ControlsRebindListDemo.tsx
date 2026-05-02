import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ControlsRebindListDemo = () => (
    <GcPage category="Settings" title="gc-controls-rebind-list" lede="Action → key bindings list with rebinding state.">
        <GcSection title="Default">
            <gc-controls-rebind-list bindings={JSON.stringify([
                { action: 'Light Attack', key: 'M1' },
                { action: 'Heavy Attack', key: 'M2' },
                { action: 'Parry / Block', key: 'Shift' },
                { action: 'Dodge Roll', key: 'Space' },
                { action: 'Sprint', key: 'Ctrl' },
                { action: 'Interact', key: 'E' },
                { action: 'Inventory', key: 'I' },
                { action: 'Listen', state: 'rebinding' },
            ])} />
        </GcSection>
    </GcPage>
)

export default ControlsRebindListDemo
