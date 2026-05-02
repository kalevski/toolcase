import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const InventoryGridDemo = () => {
    const items = [
        { id: '1', icon: '⚔', rarity: 'rare' as const },
        { id: '2', icon: '🛡', rarity: 'uncommon' as const },
        { id: '3', icon: '🧪', rarity: 'common' as const, qty: 8 },
        { id: '4', icon: '🧪', rarity: 'common' as const, qty: 12 },
        { id: '5', icon: '🜍', rarity: 'rare' as const, qty: 4 },
        { id: '6', icon: '✦', rarity: 'epic' as const },
        null, null,
        { id: '9', icon: '🗝', rarity: 'uncommon' as const },
        { id: '10', icon: '📜', rarity: 'common' as const, qty: 3 },
        { id: '11', icon: '💎', rarity: 'legendary' as const },
        { id: '12', icon: '⚒', rarity: 'uncommon' as const },
        null, null, null, null,
        { id: '17', icon: '👑', rarity: 'mythic' as const },
        null, null, null,
        { id: '21', icon: '🍖', rarity: 'common' as const, qty: 6 },
        null, null, null,
    ]
    return (
        <GcPage category="Inventory" title="gc-inventory-grid" lede="Grid of item slots wired to a list of items.">
            <GcSection title="6×4 grid">
                <gc-inventory-grid items={JSON.stringify(items)} columns={6} slot-size={52} />
            </GcSection>
        </GcPage>
    )
}

export default InventoryGridDemo
