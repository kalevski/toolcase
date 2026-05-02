import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const AmmoCounterDemo = () => (
    <GcPage category="HUD — Combat" title="gc-ammo-counter" lede="Displays current magazine and reserve ammo with an optional weapon name.">
        <GcSection title="Variants">
            <GcRow label="Rifle">
                <gc-ammo-counter mag={18} mag-max={30} reserve={120} weapon-name="AR-15" />
            </GcRow>
            <GcRow label="Shotgun">
                <gc-ammo-counter mag={6} mag-max={8} reserve={32} weapon-name="Shotgun" />
            </GcRow>
            <GcRow label="Low ammo">
                <gc-ammo-counter mag={3} mag-max={30} reserve={0} weapon-name="Pistol" />
            </GcRow>
            <GcRow label="No weapon name">
                <gc-ammo-counter mag={24} mag-max={30} reserve={90} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default AmmoCounterDemo
