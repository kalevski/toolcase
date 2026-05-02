import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const FOVSliderDemo = () => (
    <GcPage category="Settings" title="gc-fov-slider" lede="Field-of-view slider with degree readout.">
        <GcSection title="Defaults">
            <GcRow label="FOV">
                <gc-fov-slider row-label="Field of View" value={92} min={60} max={120} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default FOVSliderDemo
