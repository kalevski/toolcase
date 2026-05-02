import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ObjectiveMarkerDemo = () => (
    <GcPage category="HUD — Navigation" title="gc-objective-marker" lede="A HUD objective pin positioned in screen-space with a distance indicator.">
        <GcSection title="Variants">
            <GcRow label="Single objective">
                <div style={{ position: 'relative', width: 240, height: 100, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-objective-marker x="120" y="60" label="Boss" distance="50m" />
                </div>
            </GcRow>
            <GcRow label="Multiple objectives">
                <div style={{ position: 'relative', width: 320, height: 140, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-objective-marker x="60" y="40" label="Primary" distance="200m" />
                    <gc-objective-marker x="200" y="100" label="Secondary" distance="450m" />
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ObjectiveMarkerDemo
