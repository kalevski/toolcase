import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const BuffBarDemo = () => (
    <GcPage category="HUD — Skills" title="gc-buff-bar" lede="A tray of active buff/debuff icons with duration overlays, remaining time, and stack counts.">
        <GcSection title="Mixed buffs and debuffs">
            <GcRow label="Default">
                <gc-buff-bar buffs={JSON.stringify([
                    { id: 'haste', icon: '⚡', name: 'Haste', remaining: 15, duration: 30 },
                    { id: 'shield', icon: '🛡', name: 'Shield', remaining: 4, duration: 10, stacks: 3 },
                    { id: 'regen', icon: '💚', name: 'Regen', remaining: 25, duration: 30 },
                    { id: 'poison', icon: '☠', name: 'Poison', remaining: 8, duration: 12, debuff: true },
                    { id: 'slow', icon: '🐢', name: 'Slow', remaining: 3, duration: 6, debuff: true },
                ])} />
            </GcRow>
        </GcSection>
        <GcSection title="Buffs only">
            <GcRow label="All beneficial">
                <gc-buff-bar buffs={JSON.stringify([
                    { id: 'str', icon: '💪', name: 'Strength', remaining: 60, duration: 120 },
                    { id: 'agi', icon: '🦅', name: 'Agility', remaining: 45, duration: 60 },
                    { id: 'luck', icon: '🍀', name: 'Luck', remaining: 10, duration: 30 },
                ])} />
            </GcRow>
        </GcSection>
        <GcSection title="Large icon size">
            <GcRow label="icon-size=48">
                <gc-buff-bar icon-size="48" buffs={JSON.stringify([
                    { id: 'a', icon: '🔥', name: 'Emberstrike', remaining: 20, duration: 30, stacks: 5 },
                    { id: 'b', icon: '❄', name: 'Frostbite', remaining: 5, duration: 12, debuff: true },
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default BuffBarDemo
