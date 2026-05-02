import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const BossBarDemo = () => (
    <GcPage category="HUD — Composites" title="gc-boss-bar" lede="Boss HP bar with phase tick markers, name, and epithet.">
        <GcSection title="Default">
            <GcRow label="Phase II">
                <gc-boss-bar
                    name="The Marrow King"
                    epithet="Lord of the Bone Orchard"
                    phase="Phase II · Of Bone & Bramble"
                    hp={13820}
                    hp-max={20000}
                    phase-ticks={JSON.stringify([33, 66])}
                />
            </GcRow>
            <GcRow label="No epithet">
                <gc-boss-bar name="Ashfen Witch" hp={4200} hp-max={9000} phase-ticks={JSON.stringify([50])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default BossBarDemo
