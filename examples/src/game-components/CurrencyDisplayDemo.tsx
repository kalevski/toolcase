import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CurrencyDisplayDemo = () => (
    <GcPage category="Inventory" title="gc-currency-display" lede="Compact currency readout with glyph and amount.">
        <GcSection title="Wallets">
            <GcRow label="Gold">
                <gc-currency-display amount={4218} icon="◉" />
            </GcRow>
            <GcRow label="Premium">
                <gc-currency-display amount={120} icon="◆" color="var(--fg-arcane-bright)" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default CurrencyDisplayDemo
