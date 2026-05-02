import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const PortraitDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Portrait"
                    description="Character medallion. Square or circle, optional level badge. Props: glyph, size, ring, level, circle."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Default (square)" />
                        {/* @ts-ignore */}
                        <gc-portrait glyph="A" />
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Circle" />
                        {/* @ts-ignore */}
                        <gc-portrait glyph="K" circle />
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="With level badge" />
                        <div className="d-flex gap-3">
                            {/* @ts-ignore */}
                            <gc-portrait glyph="W" level="42" />
                            {/* @ts-ignore */}
                            <gc-portrait glyph="M" level="99" circle />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Custom ring" />
                        <div className="d-flex gap-3">
                            {/* @ts-ignore */}
                            <gc-portrait glyph="R" ring="var(--fg-mythic)" level="120" />
                            {/* @ts-ignore */}
                            <gc-portrait glyph="P" ring="var(--fg-arcane-bright)" circle />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Sizes" />
                        <div className="d-flex align-items-center gap-3">
                            {/* @ts-ignore */}
                            <gc-portrait glyph="S" size="40" />
                            {/* @ts-ignore */}
                            <gc-portrait glyph="M" size="64" level="12" />
                            {/* @ts-ignore */}
                            <gc-portrait glyph="L" size="96" level="50" circle />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default PortraitDemo
