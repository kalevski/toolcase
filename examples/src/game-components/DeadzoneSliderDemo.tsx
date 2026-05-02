import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const DeadzoneSliderDemo = () => (
    <GcPage category="Settings" title="gc-deadzone-slider" lede="Stick deadzone slider, percent-based.">
        <GcSection title="Defaults">
            <GcRow label="Deadzone">
                <gc-deadzone-slider row-label="Stick Deadzone" value={12} min={0} max={50} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default DeadzoneSliderDemo
