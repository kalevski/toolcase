import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const MinimapDemo = () => (
    <GcPage category="HUD — Navigation" title="gc-minimap" lede="A minimap canvas with configurable markers for player, enemies, and objectives.">
        <GcSection title="Default">
            <GcRow label="With markers">
                <gc-minimap world-width="1000" world-height="1000" markers={JSON.stringify([
                    { id: 'player', x: 500, y: 500, color: '#ffffff', size: 8 },
                    { id: 'enemy1', x: 320, y: 420, color: '#d23a3a', size: 5 },
                    { id: 'enemy2', x: 600, y: 700, color: '#d23a3a', size: 5 },
                    { id: 'quest', x: 750, y: 250, color: '#ffd35a', size: 7 },
                    { id: 'ally', x: 400, y: 600, color: '#3aa256', size: 6 },
                ])} />
            </GcRow>
        </GcSection>
        <GcSection title="Custom size">
            <GcRow label="180px">
                <gc-minimap size="180" world-width="800" world-height="800" markers={JSON.stringify([
                    { id: 'p', x: 400, y: 400, color: '#fff', size: 8 },
                    { id: 'e', x: 200, y: 300, color: '#d23a3a', size: 5 },
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default MinimapDemo
