import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CurrencyChipDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-currency-chip" lede="Coin glyph + formatted amount in mono font.">
        <GcSection title="Currencies">
            <GcRow label="Gold">
                <gc-currency-chip glyph="◉" amount={4218} />
            </GcRow>
            <GcRow label="Arcane shards">
                <gc-currency-chip glyph="◆" amount={24} color="var(--fg-arcane-bright)" />
            </GcRow>
            <GcRow label="Soul shards">
                <gc-currency-chip glyph="✦" amount={3} color="var(--fg-blood-bright)" />
            </GcRow>
            <GcRow label="Large amount">
                <gc-currency-chip glyph="◉" amount={1284820} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default CurrencyChipDemo
