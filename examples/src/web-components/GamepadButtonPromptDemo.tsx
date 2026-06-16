import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const GamepadButtonPromptDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="GamepadButtonPrompt"
                        description="Gamepad button glyph prompt — a sharp slate key-cap holding a glyph (A / B / X / Y or generic) with an optional caption label."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Face buttons">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="B" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="X" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="Y" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With caption labels">
                            <div className="d-flex flex-column gap-2 align-items-start">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" label="Jump" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="B" label="Cancel" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="X" label="Reload" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Generic prompts">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="RT" label="Fire" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="LB" label="Aim" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="⮝" label="Up" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom size">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" size="20" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" size="32" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" size="44" label="Interact" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Inline in a sentence">
                            <p className="mb-0">
                                Press {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" /> to confirm or {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="B" /> to go back.
                            </p>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default GamepadButtonPromptDemo
