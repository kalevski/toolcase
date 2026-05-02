import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PingDisplayDemo = () => (
    <GcPage category="Social" title="gc-ping-display" lede="Compact mono ping readout, color-coded by latency.">
        <GcSection title="Latency">
            <GcRow label="Good">
                <gc-ping-display value={42} color="var(--fg-stamina-bright)" />
            </GcRow>
            <GcRow label="Mid">
                <gc-ping-display value={98} color="var(--fg-legendary)" />
            </GcRow>
            <GcRow label="High">
                <gc-ping-display value={240} color="var(--fg-blood-bright)" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PingDisplayDemo
