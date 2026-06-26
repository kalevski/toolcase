import React from 'react'

const VersionLabelDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="VersionLabel"
                        description="Corner build / version stamp — a compact JetBrains Mono inline label showing version, build, and branch info separated by · dots."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Version only">
                            {/* @ts-ignore */}
                            <tc-version-label version="1.2.3" />
                        </tc-section-card>

                        <tc-section-card title="Version + build">
                            {/* @ts-ignore */}
                            <tc-version-label version="1.2.3" build="a4f9c12" />
                        </tc-section-card>

                        <tc-section-card title="All three segments">
                            {/* @ts-ignore */}
                            <tc-version-label version="2.0.0" build="deadbeef" branch="main" />
                        </tc-section-card>

                        <tc-section-card title="Branch only">
                            {/* @ts-ignore */}
                            <tc-version-label branch="feature/new-hud" />
                        </tc-section-card>

                        <tc-section-card title="HUD corner stamp (dark surface)">
                            <div
                                style={{
                                    background: '#0f111a',
                                    padding: '0.75rem 1rem',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    borderRadius: 0,
                                }}
                            >
                                {/* On a dark surface, re-skin the label through its
                                    public --bs-version-label-* contract so the
                                    segments keep contrast. */}
                                <tc-version-label
                                    version="0.9.1"
                                    build="7b3a8c2"
                                    branch="release"
                                    style={
                                        {
                                            '--bs-version-label-color': 'rgba(248,250,252,0.75)',
                                            '--bs-version-label-version-color': '#f8fafc',
                                            '--bs-version-label-build-color':
                                                'rgba(248,250,252,0.6)',
                                            '--bs-version-label-branch-color': '#7dd3fc',
                                            '--bs-version-label-sep-color': 'rgba(248,250,252,0.35)',
                                            '--bs-version-label-border-color':
                                                'rgba(255,255,255,0.15)',
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default VersionLabelDemo
