import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PlayerFrameDemo = () => (
    <GcPage category="HUD — Composites" title="gc-player-frame" lede="Portrait + 3-bar stack (HP/MP/Stamina) + name & class header.">
        <GcSection title="Default">
            <GcRow label="Full">
                <gc-player-frame name="Ardyn Thorne" class-name="Warden" glyph="A" level={47}
                    hp={742} hp-max={950} mp={310} mp-max={520} stamina={88} stamina-max={100} />
            </GcRow>
            <GcRow label="Without mana">
                <gc-player-frame name="Bram" class-name="Ironpath" glyph="B" level={51}
                    hp={1180} hp-max={1250} stamina={92} stamina-max={100} show-mp={false} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default PlayerFrameDemo
