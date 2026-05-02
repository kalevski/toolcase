import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ToggleRowDemo = () => (
    <GcPage category="Settings" title="gc-toggle-row" lede="Setting row with label, description, and a gilded toggle.">
        <GcSection title="Defaults">
            <GcRow label="Enabled">
                <gc-toggle-row row-label="Subtitles" description="Show dialogue captions during cinematics." value />
            </GcRow>
            <GcRow label="Disabled">
                <gc-toggle-row row-label="Screen Shake" description="Camera tremors on heavy strikes." />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ToggleRowDemo
