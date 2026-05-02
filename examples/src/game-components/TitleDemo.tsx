import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const TitleDemo = () => (
    <GcPage category="Primitives — Typography" title="gc-title" lede="Display-font tracked uppercase title in gold.">
        <GcSection title="Sizes">
            <GcRow label="18 (default)">
                <gc-title>Inventory</gc-title>
            </GcRow>
            <GcRow label="22">
                <gc-title size="22">Forsake the Vault?</gc-title>
            </GcRow>
            <GcRow label="32">
                <gc-title size="32">Ravenmoor Underdeep</gc-title>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default TitleDemo
