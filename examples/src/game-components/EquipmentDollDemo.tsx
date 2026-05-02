import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const EquipmentDollDemo = () => (
    <GcPage category="Inventory" title="gc-equipment-doll" lede="Paper-doll layout for equipment slots around a silhouette.">
        <GcSection title="Default">
            <gc-equipment-doll slots={JSON.stringify([
                { id: 'helm', label: 'Helm', item: { id: '1', icon: '⛑', rarity: 'rare' } },
                { id: 'amulet', label: 'Amulet', item: { id: '2', icon: '📿', rarity: 'epic' } },
                { id: 'chest', label: 'Chest', item: { id: '3', icon: '👕', rarity: 'epic' } },
                { id: 'cloak', label: 'Cloak', item: { id: '4', icon: '🧥', rarity: 'rare' } },
                { id: 'gloves', label: 'Gloves', item: { id: '5', icon: '✋', rarity: 'uncommon' } },
                { id: 'ring1', label: 'Ring', item: { id: '6', icon: '💍', rarity: 'legendary' } },
                { id: 'main', label: 'Main', item: { id: '7', icon: '⚔', rarity: 'legendary' } },
                { id: 'off', label: 'Off', item: { id: '8', icon: '🛡', rarity: 'rare' } },
            ])} />
        </GcSection>
    </GcPage>
)

export default EquipmentDollDemo
