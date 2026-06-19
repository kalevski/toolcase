import React from 'react'

const DividerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Divider"
                        description="Horizontal or vertical 1px hairline separator, optionally with a centered mono micro-label."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Plain horizontal">
                            {/* @ts-ignore */}
                            <tc-divider></tc-divider>
                        </tc-section-card>

                        <tc-section-card title="Labelled horizontal (attribute)">
                            {/* @ts-ignore */}
                            <tc-divider label="Section"></tc-divider>
                        </tc-section-card>

                        <tc-section-card title="Labelled horizontal (slotted children)">
                            {/* @ts-ignore */}
                            <tc-divider>or</tc-divider>
                        </tc-section-card>

                        <tc-section-card title="Vertical divider between inline content">
                            <div
                                className="d-flex align-items-center gap-3"
                                style={{ height: '2rem' }}
                            >
                                <span>Left</span>
                                {/* @ts-ignore */}
                                <tc-divider vertical></tc-divider>
                                <span>Right</span>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Vertical dividers separating inline actions">
                            <div
                                className="d-flex align-items-center gap-3"
                                style={{ height: '1.5rem' }}
                            >
                                <a href="#divider">Edit</a>
                                {/* @ts-ignore */}
                                <tc-divider vertical></tc-divider>
                                <a href="#divider">Duplicate</a>
                                {/* @ts-ignore */}
                                <tc-divider vertical></tc-divider>
                                <a href="#divider">Delete</a>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Vertical divider with taller container">
                            <div
                                className="d-flex align-items-stretch gap-3"
                                style={{ height: '5rem' }}
                            >
                                <div className="d-flex align-items-center">Panel A</div>
                                {/* @ts-ignore */}
                                <tc-divider vertical></tc-divider>
                                <div className="d-flex align-items-center">Panel B</div>
                                {/* @ts-ignore */}
                                <tc-divider vertical></tc-divider>
                                <div className="d-flex align-items-center">Panel C</div>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default DividerDemo
