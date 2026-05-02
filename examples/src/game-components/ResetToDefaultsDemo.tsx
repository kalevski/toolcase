import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ResetToDefaultsDemo = () => (
    <GcPage category="Settings" title="gc-reset-to-defaults" lede="Inline reset action with confirm/cancel danger states.">
        <GcSection title="Default">
            <GcRow label="Idle">
                <gc-reset-to-defaults row-label="Reset Settings" description="Restore the original keybinds and graphics options." />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ResetToDefaultsDemo
