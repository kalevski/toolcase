import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const DamageNumberDemo = () => (
    <GcPage category="HUD — Combat" title="gc-damage-number" lede="Floating combat text for damage, crits, heals, and misses.">
        <GcSection title="States">
            <GcRow label="Normal">
                <gc-damage-number value="84" duration="1000" />
            </GcRow>
            <GcRow label="Crit">
                <gc-damage-number value="312" crit duration="1000" />
            </GcRow>
            <GcRow label="Heal">
                <gc-damage-number value="+56" heal duration="1000" />
            </GcRow>
            <GcRow label="Miss">
                <gc-damage-number miss duration="1000" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default DamageNumberDemo
