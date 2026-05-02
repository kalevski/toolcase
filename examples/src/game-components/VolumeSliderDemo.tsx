import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const VolumeSliderDemo = () => (
    <GcPage category="Settings" title="gc-volume-slider" lede="Slider with mute toggle for audio channels.">
        <GcSection title="Defaults">
            <GcRow label="Master">
                <gc-volume-slider row-label="Master Volume" value={84} />
            </GcRow>
            <GcRow label="Music">
                <gc-volume-slider row-label="Music" value={62} />
            </GcRow>
            <GcRow label="Effects (muted)">
                <gc-volume-slider row-label="Effects" value={92} muted />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default VolumeSliderDemo
