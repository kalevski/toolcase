import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const CrosshairDemo = () => (
    <GcPage category="HUD — Combat" title="gc-crosshair" lede="Heads-up crosshair in four variants positioned absolutely over a target surface.">
        <GcSection title="Variants">
            <GcRow label="Classic">
                <div style={{ position: 'relative', width: 80, height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-crosshair variant="classic" />
                </div>
            </GcRow>
            <GcRow label="Dot">
                <div style={{ position: 'relative', width: 80, height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-crosshair variant="dot" />
                </div>
            </GcRow>
            <GcRow label="Circle">
                <div style={{ position: 'relative', width: 80, height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-crosshair variant="circle" size="12" />
                </div>
            </GcRow>
            <GcRow label="Cross">
                <div style={{ position: 'relative', width: 80, height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-crosshair variant="cross" spread="6" />
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default CrosshairDemo
