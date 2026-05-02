import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const BuffIconDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-buff-icon" lede="Single buff or debuff square with an optional timer label.">
        <GcSection title="Buffs">
            <GcRow label="Active">
                <span style={{ display: 'inline-flex', gap: 6 }}>
                    <gc-buff-icon glyph="☆" time="2:14" kind="buff" />
                    <gc-buff-icon glyph="✦" time="0:48" kind="buff" />
                    <gc-buff-icon glyph="◈" time="∞" kind="buff" />
                </span>
            </GcRow>
        </GcSection>
        <GcSection title="Debuffs">
            <GcRow label="Active">
                <span style={{ display: 'inline-flex', gap: 6 }}>
                    <gc-buff-icon glyph="☠" time="0:08" kind="debuff" />
                    <gc-buff-icon glyph="🜍" time="0:24" kind="debuff" />
                    <gc-buff-icon glyph="❄" time="0:03" kind="debuff" color="var(--fg-frost)" />
                </span>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default BuffIconDemo
