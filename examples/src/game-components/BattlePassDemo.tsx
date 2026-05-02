import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const BattlePassDemo = () => (
    <GcPage category="Progression" title="gc-battle-pass" lede="Tier track with free / premium rewards.">
        <GcSection title="Default">
            <gc-battle-pass level={28} xp={4820} xp-max={12000} season-name="Season II · Of Bone & Bramble"
                tiers={JSON.stringify(Array.from({ length: 10 }, (_, i) => ({
                    tier: i + 1,
                    free: { icon: '◉', label: '+200 Gold', claimed: i < 3 },
                    premium: { icon: '◆', label: '+50 Arcane', claimed: i < 2 },
                    locked: i > 5,
                })))}
            />
        </GcSection>
    </GcPage>
)

export default BattlePassDemo
