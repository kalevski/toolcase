import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PortraitDemo = () => (
    <GcPage category="Primitives — Atoms" title="gc-portrait" lede="Gilded medallion portrait. Square or round; optional level badge.">
        <GcSection title="Sizes">
            <GcRow label="40">
                <gc-portrait glyph="A" size="40" />
            </GcRow>
            <GcRow label="64 with level">
                <gc-portrait glyph="A" size="64" level="47" />
            </GcRow>
            <GcRow label="88 circle">
                <gc-portrait glyph="◉" size="88" circle />
            </GcRow>
            <GcRow label="Custom ring">
                <gc-portrait glyph="L" size="64" ring="var(--fg-legendary)" level="58" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PortraitDemo
