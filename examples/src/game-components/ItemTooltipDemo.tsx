import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ItemTooltipDemo = () => (
    <GcPage category="Inventory" title="gc-item-tooltip" lede="Tooltip with rarity-tinted border, stats, and lore.">
        <GcSection title="Legendary">
            <GcRow label="Greatsword">
                <gc-item-tooltip item={JSON.stringify({
                    id: 'w', name: 'Maw of the Hollow Crown', rarity: 'legendary',
                    description: 'Two-handed Greatsword',
                    stats: [
                        { label: 'Damage', value: '184–212', delta: 18 },
                        { label: 'Crit', value: '14% / x2.4' },
                        { label: 'Weight', value: '9.4' },
                    ],
                    lore: 'Forged from a king’s last vow and a smith’s last breath.',
                })} />
            </GcRow>
        </GcSection>
        <GcSection title="Common">
            <GcRow label="Potion">
                <gc-item-tooltip item={JSON.stringify({
                    id: 'p', name: 'Heart-Salve', rarity: 'common',
                    description: 'Restores 80 HP over 4s.',
                    lore: 'Tastes faintly of moss and copper.',
                })} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ItemTooltipDemo
