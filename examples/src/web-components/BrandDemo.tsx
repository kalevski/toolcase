import React from 'react'

const BrandDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Brand"
                        description="Branded wordmark with primary/secondary text, an optional micro-label chip, and a customisable accent underline bar."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Primary text (attribute)">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase"></tc-brand>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Primary + secondary text">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="Tool" secondary-text="Case"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand
                                    primary-text="Toolcase"
                                    secondary-text="Platform"
                                ></tc-brand>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="With label badge">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" label="beta"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand
                                    primary-text="Tool"
                                    secondary-text="Case"
                                    label="v2"
                                ></tc-brand>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom underline color">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" color="#e85d04"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" color="#7209b7"></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand
                                    primary-text="ToolCase"
                                    color="oklch(0.7 0.2 145)"
                                ></tc-brand>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Xlarge scale">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand primary-text="ToolCase" xlarge></tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand
                                    primary-text="Tool"
                                    secondary-text="Case"
                                    label="pro"
                                    xlarge
                                ></tc-brand>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Slotted content">
                            <div className="d-flex flex-wrap gap-4 align-items-center">
                                {/* @ts-ignore */}
                                <tc-brand>
                                    <strong slot="primary">ToolCase</strong>
                                </tc-brand>
                                {/* @ts-ignore */}
                                <tc-brand>
                                    <strong slot="primary">Tool</strong>
                                    <span slot="secondary">Case</span>
                                    <em slot="label">alpha</em>
                                </tc-brand>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BrandDemo
