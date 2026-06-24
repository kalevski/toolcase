import React from 'react'

const SpacerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Spacer"
                        description="Flexible spacing element that fills available space or provides fixed dimensions along a horizontal or vertical axis."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Fixed vertical spacer (32px)">
                            <div
                                className="d-flex flex-column"
                                style={{ border: '1px solid var(--tc-border)' }}
                            >
                                <div
                                    className="p-2"
                                    style={{ background: 'var(--tc-surface-muted)' }}
                                >
                                    Block A
                                </div>
                                {/* @ts-ignore */}
                                <tc-spacer size="32"></tc-spacer>
                                <div
                                    className="p-2"
                                    style={{ background: 'var(--tc-surface-muted)' }}
                                >
                                    Block B
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Fixed horizontal spacer (48px)">
                            <div className="d-flex align-items-center">
                                <div
                                    className="p-2"
                                    style={{ background: 'var(--tc-surface-muted)' }}
                                >
                                    Left
                                </div>
                                {/* @ts-ignore */}
                                <tc-spacer size="48" axis="horizontal"></tc-spacer>
                                <div
                                    className="p-2"
                                    style={{ background: 'var(--tc-surface-muted)' }}
                                >
                                    Right
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Flexible spacer (pushes items apart in flex row)">
                            <div
                                className="d-flex align-items-center"
                                style={{ border: '1px solid var(--tc-border)', padding: '8px' }}
                            >
                                <div
                                    className="p-2"
                                    style={{ background: 'var(--tc-surface-muted)' }}
                                >
                                    Start
                                </div>
                                {/* @ts-ignore */}
                                <tc-spacer axis="horizontal"></tc-spacer>
                                <div
                                    className="p-2"
                                    style={{ background: 'var(--tc-surface-muted)' }}
                                >
                                    End
                                </div>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SpacerDemo
