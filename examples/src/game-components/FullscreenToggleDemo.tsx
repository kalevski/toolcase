import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const FullscreenToggleDemo = () => (
    <GcPage category="Settings" title="gc-fullscreen-toggle" lede="Setting row toggle for fullscreen mode.">
        <GcSection title="Default">
            <GcRow label="Toggle">
                <gc-fullscreen-toggle row-label="Fullscreen" description="Run the game in exclusive fullscreen." value />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default FullscreenToggleDemo
