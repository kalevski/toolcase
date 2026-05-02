import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const SpeedometerDemo = () => (
    <GcPage category="HUD — Display" title="gc-speedometer" lede="A vehicle speedometer with RPM arc, gear indicator, and configurable max speed.">
        <GcSection title="Variants">
            <GcRow label="Cruising">
                <gc-speedometer value="80" max="220" rpm="0.4" gear="3" />
            </GcRow>
            <GcRow label="Highway speed">
                <gc-speedometer value="140" max="220" rpm="0.65" gear="5" />
            </GcRow>
            <GcRow label="Full throttle">
                <gc-speedometer value="210" max="220" rpm="0.95" gear="6" />
            </GcRow>
            <GcRow label="Stopped">
                <gc-speedometer value="0" max="220" rpm="0.1" gear="1" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default SpeedometerDemo
