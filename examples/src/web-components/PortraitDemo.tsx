import React from 'react'

const PortraitDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Portrait"
                            description="Standalone character portrait frame. Displays a glyph (emoji, initials, or image URL) with an optional level badge and a colored ring accent. Port of gc-portrait, restyled to the toolcase design system."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default glyph portraits">
                                <div className="d-flex flex-wrap align-items-start gap-3">
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="⚔️" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🏹" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🔮" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🛡️" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="A" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="K" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With level badge">
                                <div className="d-flex flex-wrap align-items-start gap-3">
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="⚔️" level="12" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🔮" level="34" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🏹" level="99" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom size (size attribute in px)">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="⚔️" size="32" level="5" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🔮" size="48" level="12" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🛡️" size="64" level="28" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🏹" size="96" level="51" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Ring accent (ring attribute accepts any CSS color)">
                                <div className="d-flex flex-wrap align-items-start gap-3">
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="⚔️"
                                        level="12"
                                        ring="var(--tc-app-accent)"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="🔮"
                                        level="34"
                                        ring="var(--tc-success, #16a34a)"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="🏹"
                                        level="7"
                                        ring="var(--tc-warning, #d97706)"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="🛡️"
                                        level="99"
                                        ring="var(--tc-danger, #dc2626)"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Circle variant (circle attribute)">
                                <div className="d-flex flex-wrap align-items-start gap-3">
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="⚔️" circle="" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🔮" circle="" level="34" />
                                    {/* @ts-ignore */}
                                    <tc-portrait glyph="🏹" circle="" ring="var(--tc-app-accent)" />
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="K"
                                        circle=""
                                        ring="var(--tc-success, #16a34a)"
                                        level="7"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Image URL as glyph (auto-detected from URL pattern)">
                                <div className="d-flex flex-wrap align-items-start gap-3">
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="https://avatars.githubusercontent.com/u/9919?s=64"
                                        level="42"
                                        size="64"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-portrait
                                        glyph="https://avatars.githubusercontent.com/u/9919?s=64"
                                        level="42"
                                        size="64"
                                        circle=""
                                        ring="var(--tc-app-accent)"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Theming via custom properties">
                                {/* @ts-ignore */}
                                <tc-portrait
                                    glyph="★"
                                    level="99"
                                    size="80"
                                    style={
                                        {
                                            '--bs-portrait-bg': 'var(--tc-app-accent)',
                                            '--bs-portrait-glyph-color': '#fff',
                                            '--bs-portrait-border-color': 'var(--tc-app-accent)',
                                            '--bs-portrait-level-bg': 'rgba(0,0,0,0.4)',
                                            '--bs-portrait-level-color': '#fff',
                                            '--bs-portrait-level-border':
                                                '1px solid rgba(255,255,255,0.2)',
                                        } as React.CSSProperties
                                    }
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PortraitDemo
