import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const KeyBinderDemo = () => (
    <GcPage category="Inputs" title="gc-key-binder" lede="A key-capture control that lets players rebind keyboard shortcuts.">
        <GcSection title="Variants">
            <GcRow label="With binding">
                <gc-key-binder value="Ctrl + W" />
            </GcRow>
            <GcRow label="Single key">
                <gc-key-binder value="Space" />
            </GcRow>
            <GcRow label="Unbound">
                <gc-key-binder />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default KeyBinderDemo
