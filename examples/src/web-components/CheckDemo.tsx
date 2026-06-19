import React from 'react'

const CheckDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Check"
                        description="Bootstrap checkbox wrapper with label, inline/reverse layout, indeterminate state, validation, and disabled support."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Default">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Default checkbox" value="option1" />
                                {/* @ts-ignore */}
                                <tc-check label="Checked checkbox" value="option2" checked />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Inline">
                            <div>
                                {/* @ts-ignore */}
                                <tc-check label="Option 1" value="a" inline />
                                {/* @ts-ignore */}
                                <tc-check label="Option 2" value="b" inline checked />
                                {/* @ts-ignore */}
                                <tc-check label="Option 3" value="c" inline />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Indeterminate">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Indeterminate state" indeterminate />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Disabled unchecked" disabled />
                                {/* @ts-ignore */}
                                <tc-check label="Disabled checked" checked disabled />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Validation States">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Valid checkbox" state="valid" checked />
                                {/* @ts-ignore */}
                                <tc-check label="Invalid checkbox" state="invalid" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Reverse">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-check label="Reverse layout" reverse />
                                {/* @ts-ignore */}
                                <tc-check label="Reverse checked" reverse checked />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CheckDemo
