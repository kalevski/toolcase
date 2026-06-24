import React from 'react'

const HeadingDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Heading"
                        description="Semantic heading element (h1–h6) with optional slate-ink gradient text treatment. Renders a real hN element for correct document outline."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Heading levels (as attribute)">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-heading as="h1">Heading h1</tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h2">Heading h2</tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h3">Heading h3</tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h4">Heading h4</tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h5">Heading h5</tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h6">Heading h6</tc-heading>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Default (h2, no as attribute)">
                            {/* @ts-ignore */}
                            <tc-heading>Default heading</tc-heading>
                        </tc-section-card>

                        <tc-section-card title="Gradient variant">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-heading as="h1" gradient>
                                    Gradient h1
                                </tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h2" gradient>
                                    Gradient h2
                                </tc-heading>
                                {/* @ts-ignore */}
                                <tc-heading as="h3" gradient>
                                    Gradient h3
                                </tc-heading>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default HeadingDemo
