import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const DebugOverlayDemo = () => (
    <GcPage category="HUD — Display" title="gc-debug-overlay" lede="Compact runtime diagnostics panel for performance and telemetry snapshots.">
        <GcSection title="Sample metrics">
            <gc-debug-overlay
                fps="58"
                draw-calls="142"
                triangles="88324"
                mem-mb="612.5"
            />
        </GcSection>
    </GcPage>
)

export default DebugOverlayDemo
