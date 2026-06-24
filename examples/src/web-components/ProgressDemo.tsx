import React from 'react'

const ProgressDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Progress"
                        description="Bootstrap progress bars wrapped as custom elements. Supports single bars with variants, striped and animated patterns, and stacked bars."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Plain">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="0" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="25" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="50" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="75" label></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="100" label></tc-progress>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="primary"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="success"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="danger"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="warning"></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="info"></tc-progress>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Striped">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress value="40" variant="primary" striped></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="60" variant="success" striped></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress value="80" variant="danger" striped></tc-progress>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Animated">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-progress
                                    value="40"
                                    variant="primary"
                                    striped
                                    animated
                                ></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress
                                    value="60"
                                    variant="success"
                                    striped
                                    animated
                                ></tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress
                                    value="80"
                                    variant="danger"
                                    striped
                                    animated
                                ></tc-progress>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Stacked">
                            {/* @ts-ignore */}
                            <tc-progress>
                                {/* @ts-ignore */}
                                <tc-progress-bar value="15" variant="primary"></tc-progress-bar>
                                {/* @ts-ignore */}
                                <tc-progress-bar
                                    value="30"
                                    variant="success"
                                    striped
                                ></tc-progress-bar>
                                {/* @ts-ignore */}
                                <tc-progress-bar
                                    value="20"
                                    variant="danger"
                                    striped
                                    animated
                                ></tc-progress-bar>
                                {/* @ts-ignore */}
                            </tc-progress>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ProgressDemo
