import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ManaBarDemo = () => (
    <GcPage category="HUD — Resource Bars" title="gc-mana-bar" lede="A mana/energy bar with optional segments and label.">
        <GcSection title="Variants">
            <GcRow label="Full">
                <div style={{ width: 220 }}><gc-mana-bar value={100} max={100} show-text label="MP" /></div>
            </GcRow>
            <GcRow label="Partial">
                <div style={{ width: 220 }}><gc-mana-bar value={45} max={100} show-text label="MP" /></div>
            </GcRow>
            <GcRow label="Segmented (5)">
                <div style={{ width: 220 }}><gc-mana-bar value={70} max={100} segments={5} show-text label="MP" /></div>
            </GcRow>
            <GcRow label="Segmented (10)">
                <div style={{ width: 220 }}><gc-mana-bar value={60} max={100} segments={10} /></div>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ManaBarDemo
