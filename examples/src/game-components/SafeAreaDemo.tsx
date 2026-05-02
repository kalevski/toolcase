import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const SafeAreaDemo = () => (
    <GcPage category="Layout" title="gc-safe-area" lede="Applies safe insets for notches and platform overlays.">
        <GcSection title="Safe area region" caption="Additional inset simulates tighter TV/mobile margins.">
            <div style={{ border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 6 }}>
                <gc-safe-area extra="8">
                    <div style={{ padding: 16, color: '#e6e8ec' }}>Content protected by safe-area paddings.</div>
                </gc-safe-area>
            </div>
        </GcSection>
    </GcPage>
)

export default SafeAreaDemo
