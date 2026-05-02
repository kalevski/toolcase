import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const BrightnessCalibrationDemo = () => (
    <GcPage category="Settings" title="gc-brightness-calibration" lede="Calibrate brightness via a near-black test panel + gradient slider.">
        <GcSection title="Default">
            <gc-brightness-calibration value={1.1} />
        </GcSection>
    </GcPage>
)

export default BrightnessCalibrationDemo
