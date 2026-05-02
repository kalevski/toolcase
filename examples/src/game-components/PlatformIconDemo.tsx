import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const PlatformIconDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="PlatformIcon"
                    description="Platform glyph with optional label. Props: platform, size, label."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Glyph only">
                        <div className="d-flex gap-3">
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="pc" />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="playstation" />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="xbox" />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="nintendo" />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="steam" />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="mobile" />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="web" />
                        </div>
                    </SectionCard>

                    <SectionCard title="With label">
                        <div className="d-flex flex-column gap-2">
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="pc" label />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="playstation" label />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="steam" label />
                        </div>
                    </SectionCard>

                    <SectionCard title="Sizes">
                        <div className="d-flex align-items-center gap-3">
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="steam" size="14" label />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="steam" size="20" label />
                            {/* @ts-ignore */}
                            <gc-platform-icon platform="steam" size="28" label />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default PlatformIconDemo
