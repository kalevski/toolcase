import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const DividerDemo = () => (
    <GcPage category="Primitives — Typography" title="gc-divider" lede="Gilded horizontal rule with optional centered diamond glyph.">
        <GcSection title="Variants">
            <GcRow label="With diamond">
                <div style={{ width: 360 }}><gc-divider /></div>
            </GcRow>
            <GcRow label="No diamond">
                <div style={{ width: 360 }}><gc-divider no-diamond /></div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default DividerDemo
