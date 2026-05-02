import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const VSyncToggleDemo = () => (
    <GcPage category="Settings" title="gc-vsync-toggle" lede="Setting row toggle for vertical sync.">
        <GcSection title="Default">
            <GcRow label="VSync">
                <gc-vsync-toggle row-label="VSync" description="Sync frame output to display refresh." />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default VSyncToggleDemo
