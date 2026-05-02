import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ItemCompareDemo = () => (
    <GcPage category="Inventory" title="gc-item-compare" lede="Two tooltips side-by-side with delta indicators.">
        <GcSection title="Equipped vs candidate">
            <gc-item-compare equipped={JSON.stringify({
                id: 'a', name: 'Ironbark Buckler', rarity: 'uncommon',
                description: 'Off-hand · Shield',
                stats: [{ label: 'Block', value: '24' }, { label: 'Weight', value: '3.6' }],
            })} candidate={JSON.stringify({
                id: 'b', name: 'Soulbright Aegis', rarity: 'rare',
                description: 'Off-hand · Shield',
                stats: [{ label: 'Block', value: '38', delta: 14 }, { label: 'Weight', value: '4.8', delta: -1 }],
            })} />
        </GcSection>
    </GcPage>
)

export default ItemCompareDemo
