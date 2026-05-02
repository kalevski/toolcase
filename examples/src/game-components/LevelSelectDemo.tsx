import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const LevelSelectDemo = () => (
    <GcPage category="Menus & Dialogs" title="gc-level-select" lede="Map of levels with star ratings, locks, and selection.">
        <GcSection title="Default">
            <div style={{ height: 500 }}>
                <gc-level-select selected-id="2" levels={JSON.stringify([
                    { id: '1', x: 80, y: 380, label: '1', stars: 3 },
                    { id: '2', x: 220, y: 280, label: '2', stars: 2 },
                    { id: '3', x: 360, y: 360, label: '3', stars: 1 },
                    { id: '4', x: 500, y: 240, label: '4', stars: 0 },
                    { id: '5', x: 640, y: 320, label: '5', stars: 0, locked: true },
                ])} />
            </div>
        </GcSection>
    </GcPage>
)

export default LevelSelectDemo
