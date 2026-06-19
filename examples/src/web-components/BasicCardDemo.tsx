import React from 'react'

const BasicCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BasicCard"
                            description="Small dashboard card with an optional icon chip and a two-line text block."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="With icon">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-basic-card
                                        icon="BarChart2"
                                        text-a="$24,500"
                                        text-b="Total revenue this month"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Without icon">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-basic-card text-a="1,284" text-b="Active users" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-basic-card
                                        loading
                                        text-a="placeholder"
                                        text-b="placeholder"
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BasicCardDemo
