import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const GamepadButtonPromptDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="GamepadButtonPrompt"
                    description="Round button glyph + optional label. Color coded by ABXY. Props: glyph, label, size."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="ABXY" />
                        <div className="d-flex gap-3">
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="A" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="B" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="X" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="Y" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="With label (action prompts)" />
                        <div className="d-flex flex-column gap-2">
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="A" label="Confirm" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="B" label="Cancel" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="X" label="Inventory" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="Y" label="Map" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Triggers / bumpers" />
                        <div className="d-flex gap-3">
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="LB" label="Block" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="RB" label="Parry" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="LT" label="Aim" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="RT" label="Fire" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Sizes" />
                        <div className="d-flex align-items-center gap-3">
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="A" size="20" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="A" size="32" />
                            {/* @ts-ignore */}
                            <gc-gamepad-button-prompt glyph="A" size="48" />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default GamepadButtonPromptDemo
