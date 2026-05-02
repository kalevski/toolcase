import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const SkillBarDemo = () => (
    <GcPage category="HUD — Skills" title="gc-skill-bar" lede="An ability hotbar showing slots with icons, hotkeys, cooldown overlays, and charge counts.">
        <GcSection title="Default">
            <GcRow label="Mixed states">
                <gc-skill-bar slots={JSON.stringify([
                    { id: 'q', icon: '⚔', hotkey: 'Q', cooldown: 1 },
                    { id: 'w', icon: '🛡', hotkey: 'W', cooldown: 0.4, remaining: 6 },
                    { id: 'e', icon: '🔥', hotkey: 'E', cooldown: 1, charges: 2 },
                    { id: 'r', icon: '⚡', hotkey: 'R', cooldown: 0.1, remaining: 18 },
                    { id: 'f', icon: '🧊', hotkey: 'F', cooldown: 1 },
                ])} />
            </GcRow>
        </GcSection>
        <GcSection title="All on cooldown">
            <GcRow label="All blocked">
                <gc-skill-bar slots={JSON.stringify([
                    { id: 'q', icon: '⚔', hotkey: 'Q', cooldown: 0.1, remaining: 8 },
                    { id: 'w', icon: '🛡', hotkey: 'W', cooldown: 0.2, remaining: 12 },
                    { id: 'e', icon: '🔥', hotkey: 'E', cooldown: 0.05, remaining: 30 },
                    { id: 'r', icon: '⚡', hotkey: 'R', cooldown: 0.02, remaining: 90 },
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default SkillBarDemo
