import React from 'react'

const PlaceholderDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Placeholder"
                        description="Bootstrap loading skeletons wrapped as a custom element. Supports col-span widths, size variants, glow/wave animations, and theme colours."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Col widths">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="8"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="4"></tc-placeholder>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="CSS width">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="75%"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="200px"></tc-placeholder>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" size="lg"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" size="sm"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" size="xs"></tc-placeholder>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Glow animation">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="8" animation="glow"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="4" animation="glow"></tc-placeholder>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Wave animation">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder width="12" animation="wave"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="8" animation="wave"></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder width="4" animation="wave"></tc-placeholder>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-placeholder
                                    width="12"
                                    variant="primary"
                                    animation="glow"
                                ></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder
                                    width="12"
                                    variant="secondary"
                                    animation="glow"
                                ></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder
                                    width="12"
                                    variant="success"
                                    animation="glow"
                                ></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder
                                    width="12"
                                    variant="danger"
                                    animation="glow"
                                ></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder
                                    width="12"
                                    variant="warning"
                                    animation="glow"
                                ></tc-placeholder>
                                {/* @ts-ignore */}
                                <tc-placeholder
                                    width="12"
                                    variant="info"
                                    animation="glow"
                                ></tc-placeholder>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Multiple lines (slotted children)">
                            {/* @ts-ignore */}
                            <tc-placeholder animation="glow">
                                <span className="placeholder col-12"></span>
                                <span className="placeholder col-8"></span>
                                <span className="placeholder col-4 bg-secondary"></span>
                                {/* @ts-ignore */}
                            </tc-placeholder>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default PlaceholderDemo
