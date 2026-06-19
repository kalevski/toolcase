import React from 'react'

const TitleDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Title"
                            description="Large display title text for hero sections, screen headings, and prominent labels. Port of gc-title restyled to the web-components design system."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default">
                                {/* @ts-ignore */}
                                <tc-title>The World Awaits</tc-title>
                            </tc-section-card>

                            <tc-section-card title="Center-aligned">
                                {/* @ts-ignore */}
                                <tc-title align="center">Forge Your Legend</tc-title>
                            </tc-section-card>

                            <tc-section-card title="Right-aligned">
                                {/* @ts-ignore */}
                                <tc-title align="right">Season IV</tc-title>
                            </tc-section-card>

                            <tc-section-card title="Custom size (48 px)">
                                {/* @ts-ignore */}
                                <tc-title size="48">Victory Achieved</tc-title>
                            </tc-section-card>

                            <tc-section-card title="Large display (72 px, center)">
                                {/* @ts-ignore */}
                                <tc-title size="72" align="center">
                                    GAME OVER
                                </tc-title>
                            </tc-section-card>

                            <tc-section-card title="Custom accent color">
                                {/* @ts-ignore */}
                                <tc-title
                                    align="center"
                                    style={{ '--bs-title-color': 'var(--tc-app-accent)' }}
                                >
                                    Champion
                                </tc-title>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TitleDemo
