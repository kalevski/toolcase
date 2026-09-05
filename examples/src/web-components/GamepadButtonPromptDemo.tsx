import React from 'react'

const GamepadButtonPromptDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="GamepadButtonPrompt"
                        description="Gamepad button glyph prompt — a sharp slate key-cap holding a glyph (A / B / X / Y or generic) with an optional caption label."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Face buttons">
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
                        </tc-section-card>

                        <tc-section-card title="With caption labels">
                            <div className="d-flex flex-column gap-2 align-items-start">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" label="Jump" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="B" label="Cancel" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="X" label="Reload" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Generic prompts">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="RT" label="Fire" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="LB" label="Aim" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="▲" label="Up" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom size">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" size="20" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" size="32" />
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" size="44" label="Interact" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Inline in a sentence">
                            <p className="mb-0">
                                Press {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="A" /> to confirm or{' '}
                                {/* @ts-ignore */}
                                <tc-gamepad-button-prompt glyph="B" /> to go back.
                            </p>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default GamepadButtonPromptDemo
