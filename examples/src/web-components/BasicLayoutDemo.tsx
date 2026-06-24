import React from 'react'

const BasicLayoutDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="BasicLayout"
                        description="Two-section page layout with an optional brand header and a main content area. Flat structural surface — no shadows, sharp corners, slate neutrals only."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Brand header via attribute">
                            <div style={{ border: '1px solid var(--tc-border)', height: '160px' }}>
                                {/* @ts-ignore */}
                                <tc-basic-layout brand="My Application" style={{ height: '100%' }}>
                                    <div style={{ padding: '1rem' }}>Main content area</div>
                                    {/* @ts-ignore */}
                                </tc-basic-layout>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Rich brand header via slot">
                            <div style={{ border: '1px solid var(--tc-border)', height: '160px' }}>
                                {/* @ts-ignore */}
                                <tc-basic-layout style={{ height: '100%' }}>
                                    <div
                                        slot="brand"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.75rem 1rem',
                                        }}
                                    >
                                        <strong style={{ color: 'var(--tc-text)' }}>
                                            Toolcase
                                        </strong>
                                        <span
                                            style={{
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.8rem',
                                            }}
                                        >
                                            v2.0
                                        </span>
                                    </div>
                                    <div style={{ padding: '1rem' }}>
                                        Main content with rich brand slot
                                    </div>
                                    {/* @ts-ignore */}
                                </tc-basic-layout>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Main content only (no brand)">
                            <div style={{ border: '1px solid var(--tc-border)', height: '120px' }}>
                                {/* @ts-ignore */}
                                <tc-basic-layout style={{ height: '100%' }}>
                                    <div style={{ padding: '1rem' }}>
                                        Full-height main area, no header
                                    </div>
                                    {/* @ts-ignore */}
                                </tc-basic-layout>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BasicLayoutDemo
