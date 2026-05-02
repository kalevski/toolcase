import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const Body = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        fontFamily: 'var(--fg-body, serif)',
        fontSize: '14px',
        lineHeight: 1.5,
        color: 'var(--fg-parch, #e8dcc4)',
        minHeight: '120px',
    }}>
        {children}
    </div>
)

const ArtboardBackdropDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Artboard Backdrop"
                    description="Page-level wrap providing the dark, scene, or parch background. Props: kind (dark|scene|parch), padding (none|sm|md|lg|xl)."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Kind: dark (default)">
                        {/* @ts-ignore */}
                        <gc-artboard-backdrop kind="dark">
                            <Body>Dark radial vignette from top center.</Body>
                            {/* @ts-ignore */}
                        </gc-artboard-backdrop>
                    </SectionCard>

                    <SectionCard title="Kind: scene">
                        {/* @ts-ignore */}
                        <gc-artboard-backdrop kind="scene">
                            <Body>Warm focal pool over an ink base. Use behind hero scenes.</Body>
                            {/* @ts-ignore */}
                        </gc-artboard-backdrop>
                    </SectionCard>

                    <SectionCard title="Kind: parch">
                        {/* @ts-ignore */}
                        <gc-artboard-backdrop kind="parch">
                            <Body>Flat ink-to-black gradient backdrop.</Body>
                            {/* @ts-ignore */}
                        </gc-artboard-backdrop>
                    </SectionCard>

                    <SectionCard title="Padding: none">
                        {/* @ts-ignore */}
                        <gc-artboard-backdrop kind="scene" padding="none">
                            <Body>Edge-to-edge content.</Body>
                            {/* @ts-ignore */}
                        </gc-artboard-backdrop>
                    </SectionCard>

                    <SectionCard title="Padding: lg">
                        {/* @ts-ignore */}
                        <gc-artboard-backdrop kind="dark" padding="lg">
                            <Body>Generous outer breathing room (32px).</Body>
                            {/* @ts-ignore */}
                        </gc-artboard-backdrop>
                    </SectionCard>

                    <SectionCard title="Padding: xl">
                        {/* @ts-ignore */}
                        <gc-artboard-backdrop kind="scene" padding="xl">
                            <Body>Hero padding (48px).</Body>
                            {/* @ts-ignore */}
                        </gc-artboard-backdrop>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default ArtboardBackdropDemo
