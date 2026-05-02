import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const FPSCapSelectDemo = () => (
    <GcPage category="Settings" title="gc-fps-cap-select" lede="Segment selector for frame-rate cap presets.">
        <GcSection title="Default">
            <GcRow label="Cap">
                <gc-fps-cap-select row-label="FPS Cap" value="120" options={JSON.stringify(['30', '60', '120', '144', 'Unlimited'])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default FPSCapSelectDemo
