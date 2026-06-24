import React from 'react'

const AlertDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Alert"
                        description="Contextual feedback messages for user actions. Supports all Bootstrap variants and an optional dismissible close button backed by Bootstrap's Alert plugin."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Variants">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-alert variant="primary">
                                    A primary alert — check it out!
                                </tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="secondary">
                                    A secondary alert — check it out!
                                </tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="success">
                                    A success alert — check it out!
                                </tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="danger">A danger alert — check it out!</tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="warning">
                                    A warning alert — check it out!
                                </tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="info">An info alert — check it out!</tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="light">A light alert — check it out!</tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="dark">A dark alert — check it out!</tc-alert>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Dismissible — click × to close with fade transition">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-alert variant="success" dismissible>
                                    <strong>Well done!</strong> You successfully read this important
                                    alert message.
                                    {/* @ts-ignore */}
                                </tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="warning" dismissible>
                                    <strong>Warning!</strong> Better check yourself, you're not
                                    looking too good.
                                    {/* @ts-ignore */}
                                </tc-alert>
                                {/* @ts-ignore */}
                                <tc-alert variant="danger" dismissible>
                                    <strong>Oh snap!</strong> Change a few things up and try
                                    submitting again.
                                    {/* @ts-ignore */}
                                </tc-alert>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AlertDemo
