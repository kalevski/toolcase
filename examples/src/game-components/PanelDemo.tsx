import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PanelDemo = () => (
    <GcPage category="Layout" title="gc-panel" lede="A framed content container with configurable padding, background, and border.">
        <GcSection title="Basic">
            <GcRow label="Default">
                <gc-panel><span style={{ color: '#e6e8ec' }}>Panel content goes here</span></gc-panel>
            </GcRow>
            <GcRow label="Custom padding">
                <gc-panel padding="24px"><span style={{ color: '#e6e8ec' }}>Padding 24px</span></gc-panel>
            </GcRow>
            <GcRow label="No border radius">
                <gc-panel style={{ '--gc-panel-radius': '0' } as never}><span style={{ color: '#e6e8ec' }}>Square corners</span></gc-panel>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PanelDemo
