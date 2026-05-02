import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const InteractPromptDemo = () => (
    <GcPage category="HUD — Skills" title="gc-interact-prompt" lede="A context-sensitive interaction prompt with optional hold-to-confirm progress.">
        <GcSection title="Variants">
            <GcRow label="Tap to interact">
                <gc-interact-prompt show key-label="E" text="Open chest" />
            </GcRow>
            <GcRow label="Hold progress 60%">
                <gc-interact-prompt show key-label="F" text="Pick up body" hold-progress="0.6" />
            </GcRow>
            <GcRow label="Hold progress 100%">
                <gc-interact-prompt show key-label="E" text="Unlock door" hold-progress="1" />
            </GcRow>
            <GcRow label="Gamepad button">
                <gc-interact-prompt show key-label="A" text="Talk to villager" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default InteractPromptDemo
