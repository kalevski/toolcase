import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const WaypointMarkerDemo = () => (
    <GcPage category="HUD — Navigation" title="gc-waypoint-marker" lede="Absolutely-positioned world-space waypoint with label and distance.">
        <GcSection title="Variants">
            <GcRow label="With distance">
                <div style={{ position: 'relative', width: 280, height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-waypoint-marker x="140" y="60" label="Cave" distance="120m" />
                </div>
            </GcRow>
            <GcRow label="Multiple">
                <div style={{ position: 'relative', width: 320, height: 160, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                    <gc-waypoint-marker x="80" y="50" label="Inn" distance="30m" />
                    <gc-waypoint-marker x="220" y="100" label="Blacksmith" distance="250m" />
                    <gc-waypoint-marker x="160" y="130" label="Castle" distance="1.2km" />
                </div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default WaypointMarkerDemo
