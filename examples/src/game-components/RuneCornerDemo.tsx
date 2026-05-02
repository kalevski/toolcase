import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const FrameBox: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div style={{
        position: 'relative',
        width: 240,
        height: 120,
        background: 'linear-gradient(180deg, #1a1308 0%, #0e0905 100%)',
        border: '1px solid var(--fg-gold-deep)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6)',
    }}>
        {children}
    </div>
)

const RuneCornerDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="RuneCorner"
                    description="Decorative gilded corner glyph for framed surfaces. Props: at (tl|tr|bl|br), size."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="All four corners on a frame" />
                        <FrameBox>
                            {/* @ts-ignore */}
                            <gc-rune-corner at="tl" />
                            {/* @ts-ignore */}
                            <gc-rune-corner at="tr" />
                            {/* @ts-ignore */}
                            <gc-rune-corner at="bl" />
                            {/* @ts-ignore */}
                            <gc-rune-corner at="br" />
                        </FrameBox>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Larger size" />
                        <FrameBox>
                            {/* @ts-ignore */}
                            <gc-rune-corner at="tl" size="22" />
                            {/* @ts-ignore */}
                            <gc-rune-corner at="tr" size="22" />
                        </FrameBox>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default RuneCornerDemo
