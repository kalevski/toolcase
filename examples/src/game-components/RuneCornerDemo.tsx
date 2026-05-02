import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const RuneCornerDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-rune-corner" lede="Single clip-path corner accent. Place inside a relatively-positioned container.">
        <GcSection title="Positions">
            <GcRow label="All four">
                <div style={{ position: 'relative', width: 220, height: 80, background: '#1a130c', border: '1px solid #8b6f3a' }}>
                    <gc-rune-corner at="tl" />
                    <gc-rune-corner at="tr" />
                    <gc-rune-corner at="bl" />
                    <gc-rune-corner at="br" />
                </div>
            </GcRow>
            <GcRow label="Custom size">
                <div style={{ position: 'relative', width: 220, height: 80, background: '#1a130c', border: '1px solid #8b6f3a' }}>
                    <gc-rune-corner at="tl" size="22" />
                    <gc-rune-corner at="br" size="22" />
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default RuneCornerDemo
