import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const RarityChipDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-rarity-chip" lede="Pill marking item rarity tier in its rarity color.">
        <GcSection title="All tiers">
            <GcRow label="Common → Mythic">
                <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <gc-rarity-chip rarity="common" />
                    <gc-rarity-chip rarity="uncommon" />
                    <gc-rarity-chip rarity="rare" />
                    <gc-rarity-chip rarity="epic" />
                    <gc-rarity-chip rarity="legendary" />
                    <gc-rarity-chip rarity="mythic" />
                </span>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default RarityChipDemo
