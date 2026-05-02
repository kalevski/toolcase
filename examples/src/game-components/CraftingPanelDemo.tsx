import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const CraftingPanelDemo = () => (
    <GcPage category="Inventory" title="gc-crafting-panel" lede="Recipe list with ingredient slots and FORGE button.">
        <GcSection title="Recipes">
            <gc-crafting-panel recipes={JSON.stringify([
                { id: 'r1', name: 'Knell-Steel Longsword', icon: '⚔', inputs: [{ icon: '🪨', qty: 4, have: 4 }, { icon: '🪵', qty: 2, have: 2 }] },
                { id: 'r2', name: 'Heart-Salve', icon: '🧪', inputs: [{ icon: '🌿', qty: 3, have: 3 }, { icon: '💧', qty: 1, have: 1 }] },
                { id: 'r3', name: 'Soulbright Shard', icon: '💎', inputs: [{ icon: '✦', qty: 8, have: 2 }] },
            ])} active-id="r1" />
        </GcSection>
    </GcPage>
)

export default CraftingPanelDemo
