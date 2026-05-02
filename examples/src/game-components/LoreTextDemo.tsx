import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const LoreTextDemo = () => (
    <GcPage category="Primitives — Typography" title="gc-lore-text" lede="Italic body-font flavor text in dim parchment color.">
        <GcSection title="Default">
            <GcRow label="Quote">
                <gc-lore-text>"The crown was hollow long before the king's neck cooled."</gc-lore-text>
            </GcRow>
            <GcRow label="Tip">
                <gc-lore-text>Hold the parry stance through a heavy strike to riposte. The riposte cannot be blocked — but neither can yours, if you are clumsy.</gc-lore-text>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default LoreTextDemo
