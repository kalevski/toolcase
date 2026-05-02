import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const DialogueBoxDemo = () => (
    <GcPage category="HUD — Display" title="gc-dialogue-box" lede="An RPG dialogue panel with speaker portrait area, body text, and selectable choice buttons.">
        <GcSection title="With choices">
            <GcRow label="NPC dialogue">
                <gc-dialogue-box speaker="Innkeeper" text="Welcome traveler! What brings you to Riverwood?" choices={JSON.stringify([
                    { id: 'rumors', label: 'Heard any rumors?' },
                    { id: 'room', label: "I need a room." },
                    { id: 'trade', label: "Can we trade?" },
                    { id: 'leave', label: 'Goodbye.' },
                ])} />
            </GcRow>
        </GcSection>
        <GcSection title="Without choices">
            <GcRow label="Monologue">
                <gc-dialogue-box speaker="Elder Sage" text="The prophecy speaks of one who will unite the shards of eternity and bring balance to the realm." />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default DialogueBoxDemo
