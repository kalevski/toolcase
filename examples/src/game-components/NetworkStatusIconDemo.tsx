import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const NetworkStatusIconDemo = () => (
    <GcPage category="Social" title="gc-network-status-icon" lede="Three-bar signal icon, optional latency label.">
        <GcSection title="Quality">
            <GcRow label="Strong">
                <gc-network-status-icon strength={3} label="42ms" />
            </GcRow>
            <GcRow label="Medium">
                <gc-network-status-icon strength={2} label="98ms" color="var(--fg-legendary)" />
            </GcRow>
            <GcRow label="Weak">
                <gc-network-status-icon strength={1} label="240ms" color="var(--fg-blood-bright)" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default NetworkStatusIconDemo
