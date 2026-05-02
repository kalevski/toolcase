import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const GildedFrameDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-gilded-frame" lede="Bare gilded border container without panel corner notches.">
        <GcSection title="Tones">
            <GcRow label="Dark">
                <gc-gilded-frame padding="14px" tone="dark"><span style={{ color: '#e6e8ec' }}>Dark frame body</span></gc-gilded-frame>
            </GcRow>
            <GcRow label="Leather">
                <gc-gilded-frame padding="14px" tone="leather"><span style={{ color: '#e6e8ec' }}>Leather frame body</span></gc-gilded-frame>
            </GcRow>
            <GcRow label="Transparent">
                <gc-gilded-frame padding="14px" tone="transparent"><span style={{ color: '#e6e8ec' }}>Transparent frame body</span></gc-gilded-frame>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default GildedFrameDemo
