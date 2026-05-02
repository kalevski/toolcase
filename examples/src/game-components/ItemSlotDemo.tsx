import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ItemSlotDemo = () => (
    <GcPage category="Inventory" title="gc-item-slot" lede="Square gilded socket. Glow tints by rarity; supports qty, hotkey, locked, cooldown.">
        <GcSection title="Rarity tiers">
            <GcRow label="All tiers">
                <span style={{ display: 'inline-flex', gap: 6 }}>
                    <gc-item-slot item={JSON.stringify({ id: '1', icon: '⚔', rarity: 'common' })} />
                    <gc-item-slot item={JSON.stringify({ id: '2', icon: '⚔', rarity: 'uncommon' })} />
                    <gc-item-slot item={JSON.stringify({ id: '3', icon: '⚔', rarity: 'rare' })} />
                    <gc-item-slot item={JSON.stringify({ id: '4', icon: '⚔', rarity: 'epic' })} />
                    <gc-item-slot item={JSON.stringify({ id: '5', icon: '⚔', rarity: 'legendary' })} />
                    <gc-item-slot item={JSON.stringify({ id: '6', icon: '⚔', rarity: 'mythic' })} />
                </span>
            </GcRow>
        </GcSection>
        <GcSection title="States">
            <GcRow label="Empty">
                <gc-item-slot />
            </GcRow>
            <GcRow label="With qty + hotkey">
                <gc-item-slot item={JSON.stringify({ id: 'p', icon: '🧪', rarity: 'common', qty: 12 })} hotkey="Q" />
            </GcRow>
            <GcRow label="Locked">
                <gc-item-slot item={JSON.stringify({ id: 'l', icon: '✶', rarity: 'mythic', locked: true })} />
            </GcRow>
            <GcRow label="Cooldown">
                <gc-item-slot item={JSON.stringify({ id: 'c', icon: '🔥', rarity: 'epic', cooldown: 0.4 })} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ItemSlotDemo
