import React from 'react'

const SpinnerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Spinner"
                        description="Loading indicators in six shapes — border ring, grow pulse-dot, bouncing dots, equalizer bars, sonar pulse and dashed orbit. Supports all theme variants and a small size."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Border (default)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="border"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Grow">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="grow"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Variants — border">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="secondary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="success"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="danger"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="warning"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="info"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="light"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner variant="dark"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Variants — grow">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="secondary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="success"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="danger"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="warning"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="info"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="light"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" variant="dark"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Dots">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="dots"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="dots" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="dots" variant="danger"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="dots" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Bars">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="bars"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="bars" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="bars" variant="success"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="bars" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Pulse">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse" variant="warning"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="pulse" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Orbit">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit" variant="info"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="orbit" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Small">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner size="sm" variant="primary"></tc-spinner>
                                {/* @ts-ignore */}
                                <tc-spinner type="grow" size="sm" variant="primary"></tc-spinner>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom label">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-spinner variant="primary" label="Please wait…"></tc-spinner>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SpinnerDemo
