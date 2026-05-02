import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const MouseSensitivityDemo = () => (
    <GcPage category="Settings" title="gc-mouse-sensitivity" lede="Mouse-sensitivity slider with fine resolution.">
        <GcSection title="Defaults">
            <GcRow label="Sensitivity">
                <gc-mouse-sensitivity row-label="Mouse Sensitivity" value={4.2} min={0.1} max={10} step={0.1} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default MouseSensitivityDemo
