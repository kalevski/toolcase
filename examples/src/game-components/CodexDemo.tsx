import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const CodexDemo = () => (
    <GcPage category="Progression" title="gc-codex" lede="Beastiary / lore index with tile grid and detail panel.">
        <GcSection title="Default">
            <div style={{ height: 480 }}>
                <gc-codex active-id="marrow-king" entries={JSON.stringify([
                    { id: 'marrow-king', icon: '☠', title: 'The Marrow King', stats: [{ label: 'HP', value: '20,000' }, { label: 'Type', value: 'Boss' }] },
                    { id: 'pit-hound', icon: '🐺', title: 'Pit Hound', stats: [{ label: 'HP', value: '480' }, { label: 'Type', value: 'Beast' }] },
                    { id: 'ashfen-witch', icon: '✦', title: 'Ashfen Witch', stats: [{ label: 'HP', value: '1,800' }, { label: 'Type', value: 'Caster' }] },
                    { id: 'unknown', icon: '❓', title: '???', undiscovered: true },
                ])} />
            </div>
        </GcSection>
    </GcPage>
)

export default CodexDemo
