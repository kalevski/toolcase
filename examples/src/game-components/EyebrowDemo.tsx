import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const EyebrowDemo = () => (
    <GcPage category="Primitives — Typography" title="gc-eyebrow" lede="Small-caps tracked label used above titles and on stat rows.">
        <GcSection title="Default">
            <GcRow label="Above title">
                <gc-eyebrow>Codex of Auspices</gc-eyebrow>
            </GcRow>
            <GcRow label="Stand-alone">
                <gc-eyebrow>Saga Records</gc-eyebrow>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default EyebrowDemo
