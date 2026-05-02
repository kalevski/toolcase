import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const QuestTrackerDemo = () => (
    <GcPage category="HUD — Skills" title="gc-quest-tracker" lede="A collapsible quest tracker showing active objectives with progress bars and optional markers.">
        <GcSection title="Active quests">
            <GcRow label="Multiple quests">
                <gc-quest-tracker tracker-title="Active Quests" quests={JSON.stringify([
                    {
                        id: 'q1', name: 'The Ancient Tomb', objectives: [
                            { id: 'a', text: 'Find the entrance', completed: true },
                            { id: 'b', text: 'Defeat the guardians', progress: 2, target: 5 },
                            { id: 'c', text: 'Loot the inner chamber', optional: true },
                        ]
                    },
                    {
                        id: 'q2', name: 'Supply Run', objectives: [
                            { id: 'd', text: 'Collect herbs', progress: 8, target: 10 },
                            { id: 'e', text: 'Return to Elara', completed: false },
                        ]
                    },
                ])} />
            </GcRow>
        </GcSection>
        <GcSection title="Single quest">
            <GcRow label="Nearly complete">
                <gc-quest-tracker tracker-title="Main Quest" quests={JSON.stringify([
                    {
                        id: 'm', name: 'The Dragon Prophecy', objectives: [
                            { id: '1', text: 'Find the ancient relic', completed: true },
                            { id: '2', text: 'Decipher the inscriptions', completed: true },
                            { id: '3', text: 'Confront the Dragon King', completed: false },
                        ]
                    }
                ])} />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default QuestTrackerDemo
