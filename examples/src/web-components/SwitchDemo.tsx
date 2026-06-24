import React from 'react'

const SwitchDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Switch"
                        description="Bootstrap toggle-switch wrapper with label, reverse layout, and disabled support."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Default">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-switch label="Default switch" value="option1" />
                                {/* @ts-ignore */}
                                <tc-switch label="Checked switch" value="option2" checked />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-switch label="Disabled unchecked" disabled />
                                {/* @ts-ignore */}
                                <tc-switch label="Disabled checked" checked disabled />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Reverse">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-switch label="Reverse layout" reverse />
                                {/* @ts-ignore */}
                                <tc-switch label="Reverse checked" reverse checked />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SwitchDemo
