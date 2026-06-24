import React from 'react'

// A relatively-positioned stage so tc-anchor children pin to its corners/edges.
const stageStyle: React.CSSProperties = {
    position: 'relative',
    height: '220px',
    border: '1px solid var(--tc-border)',
    background: 'var(--tc-surface-muted)',
}

const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    fontFamily: 'var(--tc-font-mono)',
    fontSize: '0.6875rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#fff',
    background: 'var(--tc-app-accent)',
    border: '1px solid var(--tc-app-accent)',
    whiteSpace: 'nowrap',
}

const Chip = ({ label }: { label: string }) => <span style={chipStyle}>{label}</span>

const AnchorDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Anchor"
                        description="Layout primitive that absolutely positions its slotted content at a corner, edge, or the centre of the nearest positioned ancestor."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="All nine positions (inset 12px)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <tc-anchor position="top-left" inset="12">
                                    <Chip label="top-left" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="top" inset="12">
                                    <Chip label="top" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="top-right" inset="12">
                                    <Chip label="top-right" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="left" inset="12">
                                    <Chip label="left" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="center" inset="12">
                                    <Chip label="center" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="right" inset="12">
                                    <Chip label="right" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="bottom-left" inset="12">
                                    <Chip label="bottom-left" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="bottom" inset="12">
                                    <Chip label="bottom" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="bottom-right" inset="12">
                                    <Chip label="bottom-right" />
                                </tc-anchor>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Larger inset (1.5rem) — corners only">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <tc-anchor position="top-left" inset="1.5rem">
                                    <Chip label="top-left" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="top-right" inset="1.5rem">
                                    <Chip label="top-right" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="bottom-left" inset="1.5rem">
                                    <Chip label="bottom-left" />
                                </tc-anchor>
                                {/* @ts-ignore */}
                                <tc-anchor position="bottom-right" inset="1.5rem">
                                    <Chip label="bottom-right" />
                                </tc-anchor>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Default position (top-left), zero inset">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <tc-anchor>
                                    <Chip label="pinned to corner" />
                                </tc-anchor>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AnchorDemo
