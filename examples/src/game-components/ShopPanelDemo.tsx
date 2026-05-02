import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ShopPanelDemo = () => (
    <GcPage category="Inventory" title="gc-shop-panel" lede="Vendor grid with prices, discounts, and sold-out states.">
        <GcSection title="Buy mode">
            <gc-shop-panel currency-icon="◉" currency={4218} items={JSON.stringify([
                { item: { id: '1', name: 'Knell-Steel Longsword', icon: '⚔', rarity: 'rare' }, price: 1240 },
                { item: { id: '2', name: 'Yew Hunter’s Bow', icon: '🏹', rarity: 'uncommon' }, price: 480, discount: 0.2 },
                { item: { id: '3', name: 'Heart-Salve', icon: '🧪', rarity: 'common' }, price: 64 },
                { item: { id: '4', name: 'Tome of the Pale March', icon: '📜', rarity: 'epic' }, price: 3800 },
                { item: { id: '5', name: 'Soulbright Shard', icon: '💎', rarity: 'rare' }, price: 920, soldOut: true },
                { item: { id: '6', name: 'Ironbark Buckler', icon: '🛡', rarity: 'uncommon' }, price: 360 },
            ])} />
        </GcSection>
    </GcPage>
)

export default ShopPanelDemo
