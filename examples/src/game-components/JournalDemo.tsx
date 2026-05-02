import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const JournalDemo = () => (
    <GcPage category="Progression" title="gc-journal" lede="Quest journal with active / completed sections, objectives, and rewards.">
        <GcSection title="Default">
            <div style={{ height: 500 }}>
                <gc-journal active-id="hollow-crown" entries={JSON.stringify([
                    { id: 'hollow-crown', title: 'The Hollow Crown', state: 'Active', body: 'Speak with the Watcher of Ash and recover the silvered locket from the Underdeep.', objectives: [
                        { id: 'a', text: 'Speak with the Watcher of Ash', completed: true },
                        { id: 'b', text: 'Recover the silvered locket', completed: true },
                        { id: 'c', text: 'Slay the Marrow King' },
                    ], rewards: ['+250 Arcane', 'Maw of the Hollow Crown'] },
                    { id: 'mire-mire', title: 'Mire & Mire', state: 'Completed' },
                    { id: 'ash-orchard', title: 'The Ash Orchard', state: 'Failed' },
                ])} />
            </div>
        </GcSection>
    </GcPage>
)

export default JournalDemo
