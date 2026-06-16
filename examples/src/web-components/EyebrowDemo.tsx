import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const EyebrowDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Eyebrow"
                        description="A small uppercase micro-label shown above a heading. Machine-facing JetBrains Mono, wide letter-spacing, slate-muted ink. Content is provided via the default slot."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Above a heading">
                            <div>
                                {/* @ts-ignore */}
                                <tc-eyebrow>What's new</tc-eyebrow>
                                <h2 className="mt-1 mb-0">Release 2.0 is here</h2>
                            </div>
                        </SectionCard>

                        <SectionCard title="Standalone labels">
                            <div className="d-flex flex-column gap-3">
                                {/* @ts-ignore */}
                                <tc-eyebrow>Getting started</tc-eyebrow>
                                {/* @ts-ignore */}
                                <tc-eyebrow>Featured</tc-eyebrow>
                                {/* @ts-ignore */}
                                <tc-eyebrow>Step 01</tc-eyebrow>
                            </div>
                        </SectionCard>

                        <SectionCard title="Theming via --bs-eyebrow-* custom properties">
                            <div
                                style={
                                    {
                                        '--bs-eyebrow-color': 'var(--tc-accent)',
                                        '--bs-eyebrow-letter-spacing': '0.2em',
                                    } as React.CSSProperties
                                }
                            >
                                {/* @ts-ignore */}
                                <tc-eyebrow>Accented eyebrow</tc-eyebrow>
                                <h3 className="mt-1 mb-0">Override the contract, not the markup</h3>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default EyebrowDemo
