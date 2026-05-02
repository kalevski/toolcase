import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const InvertAxisToggleDemo = () => (
    <GcPage category="Settings" title="gc-invert-axis-toggle" lede="Setting row toggle for inverting the Y-axis.">
        <GcSection title="Default">
            <GcRow label="Invert Y">
                <gc-invert-axis-toggle row-label="Invert Y Axis" description="Push stick down to look up." />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default InvertAxisToggleDemo
