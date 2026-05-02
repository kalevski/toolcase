import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const BlurOverlayDemo = () => (
    <GcPage category="HUD — Display" title="gc-blur-overlay" lede="Applies a fullscreen blur layer for pause, focus, or modal moments.">
        <GcSection title="Blur Variants">
            <GcRow label="Soft blur">
                <div style={{ position: 'relative', height: 120, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(120deg, #244b7a, #6f2c4d)' }}>
                    <gc-blur-overlay blur="6" background="rgba(0,0,0,0.28)" />
                </div>
            </GcRow>
            <GcRow label="Strong blur">
                <div style={{ position: 'relative', height: 120, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(120deg, #294437, #4f2966)' }}>
                    <gc-blur-overlay blur="14" background="rgba(0,0,0,0.42)" />
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default BlurOverlayDemo
