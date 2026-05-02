import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const LootListDemo = () => (
    <GcPage category="Inventory" title="gc-loot-list" lede="Pickup list of recently found items.">
        <GcSection title="Drops">
            <gc-loot-list items={JSON.stringify([
                { id: '1', name: 'Knell-Steel Longsword', icon: '⚔', rarity: 'rare' },
                { id: '2', name: 'Heart-Salve', icon: '🧪', rarity: 'common', qty: 3 },
                { id: '3', name: 'Soulbright Shard', icon: '💎', rarity: 'epic' },
                { id: '4', name: 'Tome of the Pale March', icon: '📜', rarity: 'epic' },
            ])} />
        </GcSection>
    </GcPage>
)

export default LootListDemo
