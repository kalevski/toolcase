import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const headingStyle: React.CSSProperties = {
    margin: '0 0 0.25rem',
    fontSize: '1rem',
    fontWeight: 600,
}

const bodyStyle: React.CSSProperties = {
    margin: 0,
    opacity: 0.85,
    fontSize: '0.875rem',
}

const Sample = ({ title }: { title: string }) => (
    <>
        <p style={headingStyle}>{title}</p>
        <p style={bodyStyle}>A full-bleed backdrop surface for staging artwork, previews, or hero content.</p>
    </>
)

const ArtboardBackdropDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Artboard Backdrop"
                        description="Decorative full-bleed backdrop surface. Ported from game-components but re-skinned to the design system — slate ramp tones, sharp corners, hairline borders, no fantasy chrome."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Tones (kind)">
                            <div className="d-flex flex-column gap-3">
                                {/* @ts-ignore */}
                                <tc-artboard-backdrop kind="dark">
                                    <Sample title="dark — ink surface" />
                                {/* @ts-ignore */}
                                </tc-artboard-backdrop>
                                {/* @ts-ignore */}
                                <tc-artboard-backdrop kind="scene">
                                    <Sample title="scene — muted slate well" />
                                {/* @ts-ignore */}
                                </tc-artboard-backdrop>
                                {/* @ts-ignore */}
                                <tc-artboard-backdrop kind="parch">
                                    <Sample title="parch — light paper" />
                                {/* @ts-ignore */}
                                </tc-artboard-backdrop>
                            </div>
                        </SectionCard>

                        <SectionCard title="Padding scale">
                            <div className="d-flex flex-column gap-3">
                                {(['none', 'sm', 'md', 'lg', 'xl'] as const).map(pad => (
                                    // @ts-ignore
                                    <tc-artboard-backdrop key={pad} kind="scene" padding={pad}>
                                        <Sample title={`padding="${pad}"`} />
                                    {/* @ts-ignore */}
                                    </tc-artboard-backdrop>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Default (kind=dark, padding=md)">
                            {/* @ts-ignore */}
                            <tc-artboard-backdrop>
                                <Sample title="Defaults applied" />
                            {/* @ts-ignore */}
                            </tc-artboard-backdrop>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ArtboardBackdropDemo
