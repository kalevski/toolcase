import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const LevelHeaderDemo = () => (
    <GcPage category="HUD — Composites" title="gc-level-header" lede="Level number + class title + XP bar with next-tier readout.">
        <GcSection title="Default">
            <GcRow label="Mid-tier">
                <gc-level-header level={47} title="Warden of the Hollow" xp={4820} xp-max={12000} />
            </GcRow>
            <GcRow label="Near level-up">
                <gc-level-header level={28} title="Ash-Caller" xp={11540} xp-max={12000} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default LevelHeaderDemo
