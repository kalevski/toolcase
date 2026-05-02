import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PanelHeaderDemo = () => (
    <GcPage category="Primitives — Typography" title="gc-panel-header" lede="Eyebrow + title pair, with optional right-aligned slot.">
        <GcSection title="Variants">
            <GcRow label="Default">
                <gc-panel-header eyebrow="Satchel" header-title="Inventory" />
            </GcRow>
            <GcRow label="With right slot">
                <gc-panel-header eyebrow="Saga Records" header-title="Load Saga">
                    <span slot="right" style={{ fontFamily: 'monospace', fontSize: 11, color: '#b8a47e', letterSpacing: '0.14em' }}>3 / 8 USED</span>
                </gc-panel-header>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PanelHeaderDemo
