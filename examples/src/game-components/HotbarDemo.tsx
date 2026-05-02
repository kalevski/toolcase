import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const HotbarDemo = () => {
    const slots = [
        { item: { id: '1', icon: '⚔', rarity: 'rare' as const }, hotkey: '1' },
        { item: { id: '2', icon: '🛡', rarity: 'uncommon' as const }, hotkey: '2' },
        { item: { id: '3', icon: '✦', rarity: 'epic' as const, cooldown: 0.65 }, hotkey: '3' },
        { item: { id: '4', icon: '🔥', rarity: 'legendary' as const, cooldown: 0.3 }, hotkey: '4' },
        { item: { id: '5', icon: '❄', rarity: 'rare' as const }, hotkey: '5' },
        { item: { id: '6', icon: '☩', rarity: 'uncommon' as const }, hotkey: '6' },
        { item: { id: 'q', icon: '⚕', rarity: 'common' as const, qty: 12 }, hotkey: 'Q' },
        { item: { id: 'e', icon: '🜍', rarity: 'rare' as const, qty: 3 }, hotkey: 'E' },
        { item: null, hotkey: 'R' },
        { item: null, hotkey: 'F' },
    ]
    return (
        <GcPage category="HUD — Composites" title="gc-hotbar" lede="Action bar: row of item slots with hotkey labels.">
            <GcSection title="Default">
                <gc-hotbar slots={JSON.stringify(slots)} />
            </GcSection>
        </GcPage>
    )
}

export default HotbarDemo
