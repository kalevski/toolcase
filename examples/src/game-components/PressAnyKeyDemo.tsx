import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PressAnyKeyDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-press-any-key" lede="Breathing prompt used on title screens.">
        <GcSection title="Default">
            <GcRow label="Prompt">
                <gc-press-any-key>Press any key to begin</gc-press-any-key>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PressAnyKeyDemo
