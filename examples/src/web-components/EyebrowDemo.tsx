import React from 'react'

const EyebrowDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Eyebrow"
                        description="A small uppercase micro-label shown above a heading. Machine-facing JetBrains Mono, wide letter-spacing, slate-muted ink. Content is provided via the default slot."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Above a heading">
                            <div>
                                {/* @ts-ignore */}
                                <tc-eyebrow>What's new</tc-eyebrow>
                                <h2 className="mt-1 mb-0">Release 2.0 is here</h2>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Standalone labels">
                            <div className="d-flex flex-column gap-3">
                                {/* @ts-ignore */}
                                <tc-eyebrow>Getting started</tc-eyebrow>
                                {/* @ts-ignore */}
                                <tc-eyebrow>Featured</tc-eyebrow>
                                {/* @ts-ignore */}
                                <tc-eyebrow>Step 01</tc-eyebrow>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Theming via --bs-eyebrow-* custom properties">
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
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default EyebrowDemo
