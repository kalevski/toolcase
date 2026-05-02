import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const VignetteOverlayDemo = () => (
    <GcPage category="HUD — Display" title="gc-vignette-overlay" lede="Darkens screen edges to focus center and improve atmosphere.">
        <GcSection title="Intensity">
            <GcRow label="Light">
                <div style={{ position: 'relative', height: 120, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(140deg, #263f60, #3f2b54)' }}>
                    <gc-vignette-overlay intensity="0.25" />
                </div>
            </GcRow>
            <GcRow label="Heavy">
                <div style={{ position: 'relative', height: 120, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(140deg, #2f4c70, #54396c)' }}>
                    <gc-vignette-overlay intensity="0.65" />
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default VignetteOverlayDemo
