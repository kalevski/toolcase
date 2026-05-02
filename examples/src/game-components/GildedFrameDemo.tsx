import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const Body = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        fontFamily: 'var(--fg-body, serif)',
        fontSize: '14px',
        lineHeight: 1.5,
    }}>
        {children}
    </div>
)

const GildedFrameDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Gilded Frame"
                    description="Bare gilded border container. Props: tone (dark|leather|transparent), padding (none|sm|md|lg|xl)."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Tone: dark (default)">
                        {/* @ts-ignore */}
                        <gc-gilded-frame tone="dark">
                            <Body>Dark ink gradient inside a gilded bronze border.</Body>
                            {/* @ts-ignore */}
                        </gc-gilded-frame>
                    </SectionCard>

                    <SectionCard title="Tone: leather">
                        {/* @ts-ignore */}
                        <gc-gilded-frame tone="leather">
                            <Body>Warm leather gradient inside a gilded bronze border.</Body>
                            {/* @ts-ignore */}
                        </gc-gilded-frame>
                    </SectionCard>

                    <SectionCard title="Tone: transparent">
                        {/* @ts-ignore */}
                        <gc-gilded-frame tone="transparent">
                            <Body>Transparent fill. Use to overlay a gilded border on any backdrop.</Body>
                            {/* @ts-ignore */}
                        </gc-gilded-frame>
                    </SectionCard>

                    <SectionCard title="Padding: sm">
                        {/* @ts-ignore */}
                        <gc-gilded-frame tone="dark" padding="sm">
                            <Body>Tight padding (6px).</Body>
                            {/* @ts-ignore */}
                        </gc-gilded-frame>
                    </SectionCard>

                    <SectionCard title="Padding: lg">
                        {/* @ts-ignore */}
                        <gc-gilded-frame tone="leather" padding="lg">
                            <Body>Generous padding (20px).</Body>
                            {/* @ts-ignore */}
                        </gc-gilded-frame>
                    </SectionCard>

                    <SectionCard title="Padding: xl">
                        {/* @ts-ignore */}
                        <gc-gilded-frame tone="dark" padding="xl">
                            <Body>Hero padding (28px).</Body>
                            {/* @ts-ignore */}
                        </gc-gilded-frame>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default GildedFrameDemo
