import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const KeyDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-key" lede="Keycap pill rendered in mono font on a gilded dark background.">
        <GcSection title="Variants">
            <GcRow label="Single key">
                <gc-key>E</gc-key>
            </GcRow>
            <GcRow label="Long label">
                <gc-key>Space</gc-key>
            </GcRow>
            <GcRow label="Modifier">
                <gc-key>Ctrl</gc-key>
            </GcRow>
            <GcRow label="Inline row">
                <span style={{ display: 'inline-flex', gap: 4 }}>
                    <gc-key>W</gc-key><gc-key>A</gc-key><gc-key>S</gc-key><gc-key>D</gc-key>
                </span>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default KeyDemo
