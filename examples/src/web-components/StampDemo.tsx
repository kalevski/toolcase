import React from 'react'

const cardStyle: React.CSSProperties = {
    position: 'relative',
    background: 'var(--tc-surface)',
    border: '1px solid var(--tc-border)',
    padding: '2rem',
    minHeight: '100px',
}

const StampDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Stamp"
                        description="Approval-stamp badge pinned to a corner of a relatively-positioned card, tilted a few degrees so it reads as pressed-on-paper rather than a flat badge. Supports six status colors, four corner positions, and a themeable rotation angle."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Colors (label attribute, top-right default)">
                            <div className="d-flex flex-wrap gap-4">
                                <div style={{ ...cardStyle, minWidth: '160px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Card
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="primary" label="Primary"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '160px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Card
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="secondary" label="Secondary"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '160px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Card
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="success" label="Success"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '160px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Card
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="danger" label="Danger"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '160px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Card
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="warning" label="Warning"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '160px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Card
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="info" label="Info"></tc-stamp>
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Corner positions (success color)">
                            <div className="d-flex flex-wrap gap-4">
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        top-right (default)
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="success" label="New"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        top-left
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp
                                        color="success"
                                        position="top-left"
                                        label="New"
                                    ></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        bottom-right
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp
                                        color="success"
                                        position="bottom-right"
                                        label="New"
                                    ></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        bottom-left
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp
                                        color="success"
                                        position="bottom-left"
                                        label="New"
                                    ></tc-stamp>
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Rotation angle (askew like a real stamp)">
                            <div className="d-flex flex-wrap gap-4">
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        default (-8deg)
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="success" label="Approved"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        angle="-14"
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="danger" label="Paid" angle="-14"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        angle="6deg"
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="info" label="Draft" angle="6deg"></tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        inline --bs-stamp-rotation: 0
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp
                                        color="secondary"
                                        label="Flat"
                                        style={
                                            { '--bs-stamp-rotation': '0deg' } as React.CSSProperties
                                        }
                                    ></tc-stamp>
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Slotted children (label attribute absent)">
                            <div className="d-flex flex-wrap gap-4">
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Bold text slot
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="danger" position="top-right">
                                        <strong>Sale</strong>
                                    </tc-stamp>
                                </div>
                                <div style={{ ...cardStyle, minWidth: '200px' }}>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        Text node slot
                                    </span>
                                    {/* @ts-ignore */}
                                    <tc-stamp color="info" position="top-left">
                                        Beta
                                    </tc-stamp>
                                </div>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StampDemo
