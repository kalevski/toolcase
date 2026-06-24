import React from 'react'

const frameStyle: React.CSSProperties = {
    position: 'relative',
    width: 240,
    height: 120,
    background: 'var(--tc-surface-muted)',
    border: '1px solid var(--tc-border)',
}

const RuneCornerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="RuneCorner"
                        description="Decorative corner accent for framed surfaces. Port of gc-rune-corner, re-voiced for the design system — flat ink L-shaped clip, no fantasy chrome. Attrs: at (tl|tr|bl|br), size (px)."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="All four corners">
                            <p className="mb-3" style={{ opacity: 0.85 }}>
                                Place one corner accent per edge of a positioned container using the{' '}
                                <code>at</code> attribute (<code>tl</code>, <code>tr</code>,{' '}
                                <code>bl</code>, <code>br</code>).
                            </p>
                            <div style={frameStyle}>
                                {/* @ts-ignore */}
                                <tc-rune-corner at="tl" />
                                {/* @ts-ignore */}
                                <tc-rune-corner at="tr" />
                                {/* @ts-ignore */}
                                <tc-rune-corner at="bl" />
                                {/* @ts-ignore */}
                                <tc-rune-corner at="br" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title='Larger size (size="22")'>
                            <p className="mb-3" style={{ opacity: 0.85 }}>
                                Pass a bare number to <code>size</code> (interpreted as px) to scale
                                the accent up or down.
                            </p>
                            <div style={frameStyle}>
                                {/* @ts-ignore */}
                                <tc-rune-corner at="tl" size="22" />
                                {/* @ts-ignore */}
                                <tc-rune-corner at="tr" size="22" />
                                {/* @ts-ignore */}
                                <tc-rune-corner at="bl" size="22" />
                                {/* @ts-ignore */}
                                <tc-rune-corner at="br" size="22" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom color via CSS variable">
                            <p className="mb-3" style={{ opacity: 0.85 }}>
                                Override <code>--bs-rune-corner-bg</code> inline to change the
                                accent color. The default is <code>var(--tc-app-accent)</code>.
                            </p>
                            <div style={frameStyle}>
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="tl"
                                    style={{ '--bs-rune-corner-bg': 'var(--tc-danger)' } as React.CSSProperties}
                                />
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="tr"
                                    style={{ '--bs-rune-corner-bg': 'var(--tc-danger)' } as React.CSSProperties}
                                />
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="bl"
                                    style={{ '--bs-rune-corner-bg': 'var(--tc-danger)' } as React.CSSProperties}
                                />
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="br"
                                    style={{ '--bs-rune-corner-bg': 'var(--tc-danger)' } as React.CSSProperties}
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Muted opacity">
                            <p className="mb-3" style={{ opacity: 0.85 }}>
                                Lower <code>--bs-rune-corner-opacity</code> for a subtle watermark
                                treatment.
                            </p>
                            <div style={frameStyle}>
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="tl"
                                    style={{ '--bs-rune-corner-opacity': '0.35' } as React.CSSProperties}
                                />
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="tr"
                                    style={{ '--bs-rune-corner-opacity': '0.35' } as React.CSSProperties}
                                />
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="bl"
                                    style={{ '--bs-rune-corner-opacity': '0.35' } as React.CSSProperties}
                                />
                                {/* @ts-ignore */}
                                <tc-rune-corner
                                    at="br"
                                    style={{ '--bs-rune-corner-opacity': '0.35' } as React.CSSProperties}
                                />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RuneCornerDemo
