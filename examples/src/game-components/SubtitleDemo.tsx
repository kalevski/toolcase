import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const SubtitleDemo = () => (
    <GcPage category="HUD — Display" title="gc-subtitle" lede="A cinematic subtitle bar for dialogue or narration, with optional speaker attribution.">
        <GcSection title="Variants">
            <GcRow label="With speaker">
                <gc-subtitle text="It is dangerous to go alone. Take this." speaker="Old Man" />
            </GcRow>
            <GcRow label="No speaker">
                <gc-subtitle text="The castle gates swing open with a grinding groan..." />
            </GcRow>
            <GcRow label="Long text">
                <gc-subtitle text="Long ago, in an age before memory, the world was forged by the gods from the bones of the First Dragon." speaker="Narrator" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default SubtitleDemo
