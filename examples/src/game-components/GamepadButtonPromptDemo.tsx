import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const GamepadButtonPromptDemo = () => (
    <GcPage category="Inputs" title="gc-gamepad-button-prompt" lede="On-screen gamepad button glyphs with optional labels.">
        <GcSection title="PlayStation glyphs">
            <GcRow label="Face buttons">
                <gc-stack direction="horizontal" gap="10px">
                    <gc-gamepad-button-prompt glyph="cross" label="Confirm" />
                    <gc-gamepad-button-prompt glyph="circle" label="Cancel" />
                    <gc-gamepad-button-prompt glyph="square" label="Interact" />
                    <gc-gamepad-button-prompt glyph="triangle" label="Map" />
                </gc-stack>
            </GcRow>
        </GcSection>
        <GcSection title="Xbox-style glyphs">
            <GcRow label="Face buttons">
                <gc-stack direction="horizontal" gap="10px">
                    <gc-gamepad-button-prompt glyph="A" label="Jump" />
                    <gc-gamepad-button-prompt glyph="B" label="Roll" />
                    <gc-gamepad-button-prompt glyph="X" label="Attack" />
                    <gc-gamepad-button-prompt glyph="Y" label="Ability" />
                </gc-stack>
            </GcRow>
        </GcSection>
        <GcSection title="D-pad">
            <GcRow label="Directions">
                <gc-stack direction="horizontal" gap="10px">
                    <gc-gamepad-button-prompt glyph="dpad-up" />
                    <gc-gamepad-button-prompt glyph="dpad-down" />
                    <gc-gamepad-button-prompt glyph="dpad-left" />
                    <gc-gamepad-button-prompt glyph="dpad-right" />
                </gc-stack>
            </GcRow>
        </GcSection>
    </GcPage>
)

export default GamepadButtonPromptDemo
